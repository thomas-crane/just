import { BuildIncremental, build, BuildOptions } from 'esbuild';
import { replaceTscAliasPaths } from 'tsc-alias';
import { existsSync, rmSync } from 'fs';
import { resolve } from 'path';

import { timer, error } from './logger';
import type TSConfig from './tsconfig';

export default class Builder {
  private tsconfig: TSConfig;
  private builder?: BuildIncremental;

  isFailed = false;

  constructor(tsconfig: TSConfig) {
    this.tsconfig = tsconfig;
  }

  private clean() {
    const path = resolve(process.cwd(), this.tsconfig.outDir);

    if (!existsSync(path)) {
      return;
    }

    return rmSync(path, { recursive: true, force: true });
  }

  private get options(): BuildOptions {
    return {
      format: 'cjs',
      platform: 'node',
      minify: true,
      absWorkingDir: process.cwd(),
      entryPoints: this.tsconfig.files,
      sourcemap: this.tsconfig.sourceMap,
      outdir: this.tsconfig.outDir,
      tsconfig: this.tsconfig.filePath,
    };
  }

  async build() {
    try {
      const time = timer();
      time.start('building...');

      this.isFailed = false;
      this.clean();

      await build(this.options);

      if (this.tsconfig.hasPaths) {
        await replaceTscAliasPaths({
          configFile: this.tsconfig.filePath,
          outDir: this.tsconfig.outDir,
        });
      }

      time.end('build successfully', `(${this.tsconfig.files.length} modules)`);
    } catch (err) {
      console.log(err);

      this.isFailed = true;
      error('build failed');
    }
  }

  async start() {
    try {
      const time = timer();
      time.start('building...');

      this.isFailed = false;

      if (this.builder) {
        await this.rebuild();
      } else {
        this.clean();

        this.builder = await build({
          ...this.options,
          incremental: true,
        });
      }

      time.end('build successfully');
    } catch {
      this.isFailed = true;
      error('build failed');
    }
  }

  rebuild() {
    if (!this.builder?.stop) {
      return;
    }

    return this.builder.rebuild();
  }

  stop() {
    if (!this.builder?.stop) {
      return;
    }

    this.builder.stop();
    this.builder.rebuild.dispose();
  }
}
