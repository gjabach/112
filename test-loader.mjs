import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extname, resolve as pathResolve } from 'node:path';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const apiNodeModules = pathResolve(projectRoot, 'apps/api/node_modules');

export async function resolve(specifier, context, nextResolve) {
  // Map @novelist/shared
  if (specifier === '@novelist/shared') {
    return { url: pathToFileURL(pathResolve(projectRoot, 'packages/shared/src/index.ts')).href, shortCircuit: true };
  }
  if (specifier.startsWith('@novelist/shared/')) {
    const sub = specifier.replace('@novelist/shared/', '');
    const p = sub.startsWith('src/') ? pathResolve(projectRoot, 'packages/shared', sub) : pathResolve(projectRoot, 'packages/shared/src', sub);
    const target = existsSync(p + '.ts') ? p + '.ts' : p;
    return { url: pathToFileURL(target).href, shortCircuit: true };
  }

  // Map @novelist/ai-core
  if (specifier === '@novelist/ai-core') {
    return { url: pathToFileURL(pathResolve(projectRoot, 'packages/ai-core/src/index.ts')).href, shortCircuit: true };
  }
  if (specifier.startsWith('@novelist/ai-core/')) {
    const sub = specifier.replace('@novelist/ai-core/', '');
    const p = sub.startsWith('src/') ? pathResolve(projectRoot, 'packages/ai-core', sub) : pathResolve(projectRoot, 'packages/ai-core/src', sub);
    const target = existsSync(p + '.ts') ? p + '.ts' : p;
    return { url: pathToFileURL(target).href, shortCircuit: true };
  }

  // If relative or file:
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('file:')) {
    const parentURL = context.parentURL ? new URL(context.parentURL) : null;
    const targetUrl = specifier.startsWith('file:') ? new URL(specifier) : new URL(specifier, parentURL);
    const targetPath = fileURLToPath(targetUrl);

    if (!extname(targetPath)) {
      if (existsSync(targetPath + '.ts')) {
        return { url: pathToFileURL(targetPath + '.ts').href, shortCircuit: true };
      }
      if (existsSync(targetPath + '.js')) {
        return { url: pathToFileURL(targetPath + '.js').href, shortCircuit: true };
      }
      if (existsSync(targetPath + '/index.ts')) {
        return { url: pathToFileURL(targetPath + '/index.ts').href, shortCircuit: true };
      }
      if (existsSync(targetPath + '/index.js')) {
        return { url: pathToFileURL(targetPath + '/index.js').href, shortCircuit: true };
      }
    }
  }

  try {
    const result = await nextResolve(specifier, context);
    if (result.url.includes('node_modules/@novelist') || result.url.includes('node_modules\\@novelist')) {
      const p = fileURLToPath(result.url);
      const realP = realpathSync(p);
      return { url: pathToFileURL(realP).href, shortCircuit: true };
    }
    return result;
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      if (err.url) {
        const urlPath = fileURLToPath(err.url);
        if (existsSync(urlPath + '.ts')) {
          return { url: pathToFileURL(urlPath + '.ts').href, shortCircuit: true };
        }
        if (existsSync(urlPath + '.js')) {
          return { url: pathToFileURL(urlPath + '.js').href, shortCircuit: true };
        }
        if (existsSync(urlPath + '/index.ts')) {
          return { url: pathToFileURL(urlPath + '/index.ts').href, shortCircuit: true };
        }
      }
      // Try resolving package from apps/api/node_modules
      if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('file:')) {
        const fakeParent = pathToFileURL(pathResolve(apiNodeModules, 'dummy.js')).href;
        return nextResolve(specifier, { ...context, parentURL: fakeParent });
      }
    }
    throw err;
  }
}
