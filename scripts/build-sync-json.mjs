#!/usr/bin/env node
// 把仓库里的 docs/ 目录转成 caw-server /api/docs/{product}/sync 的请求 JSON。
//
// 目录约定(见 README.md):
//   docs/
//     toc.json            声明目录树(顺序、层级、各语言文件与标题)
//     zh-CN/*.md          中文正文(路径相对 docs/zh-CN/)
//     en/*.md             英文正文(路径相对 docs/en/)
//     images/*            图片(正文里用相对 docs 根的路径引用,如 images/foo.png)
//
// 用法:
//   node build-sync-json.mjs [docsDir] > sync.json
//   环境变量 GITHUB_SHA / GITHUB_REPOSITORY 会写进 commit / repo(CI 自动带)。
//
// 无三方依赖,纯 Node(>=18)。

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const docsDir = process.argv[2] || 'docs';
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const CONTENT_TYPE = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function toPosix(p) {
  return p.split(sep).join('/');
}

function firstHeading(md) {
  const m = md.match(/^\s*#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : '';
}

// toc.json → 扁平页面列表(path 为 slug 链)
function flattenToc(nodes, prefix, out) {
  nodes.forEach((node, i) => {
    if (!node.slug) throw new Error(`toc node missing slug at ${prefix.join('/')}[${i}]`);
    const path = [...prefix, node.slug];
    const translations = {};
    const files = node.files || {};
    const titles = node.titles || {};
    for (const [locale, rel] of Object.entries(files)) {
      const abs = join(docsDir, locale, rel);
      let content = '';
      try {
        content = readFileSync(abs, 'utf8');
      } catch {
        throw new Error(`missing content file: ${abs}`);
      }
      const title = titles[locale] || firstHeading(content) || node.slug;
      translations[locale] = { title, content };
    }
    out.push({
      path,
      sort_order: typeof node.sort === 'number' ? node.sort : i,
      hidden: !!node.hidden,
      translations,
    });
    if (Array.isArray(node.children) && node.children.length) {
      flattenToc(node.children, path, out);
    }
  });
  return out;
}

// 递归收集图片,path 为相对 docs 根的 posix 路径
function collectAssets(dir, root, out) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      // 跳过 locale 正文目录(只在里面找 md,不当图片扫)
      collectAssets(abs, root, out);
    } else {
      const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
      if (IMAGE_EXT.has(ext)) {
        const relPath = toPosix(relative(root, abs));
        out.push({
          path: relPath,
          content_base64: readFileSync(abs).toString('base64'),
          content_type: CONTENT_TYPE[ext] || 'application/octet-stream',
        });
      }
    }
  }
  return out;
}

const toc = JSON.parse(readFileSync(join(docsDir, 'toc.json'), 'utf8'));
if (!Array.isArray(toc.pages)) throw new Error('toc.json must have a "pages" array');

const pages = flattenToc(toc.pages, [], []);
const assets = collectAssets(docsDir, docsDir, []);

const payload = {
  commit: process.env.GITHUB_SHA || '',
  repo: process.env.GITHUB_REPOSITORY || '',
  pages,
  assets,
};

process.stdout.write(JSON.stringify(payload));
