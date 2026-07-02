import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

describe('CDK app structure', () => {
  it('has cdk.json with app entry', () => {
    const cdk = JSON.parse(readFileSync(join(ROOT, 'cdk.json'), 'utf-8'));
    expect(cdk.app).toContain('bin/infra.ts');
  });

  it('has package.json with CDK scripts', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
    expect(pkg.scripts['cdk:diff']).toBeDefined();
    expect(pkg.scripts['cdk:deploy']).toBeDefined();
  });

  it('has bin/infra.ts as entry point', () => {
    expect(existsSync(join(ROOT, 'bin', 'infra.ts'))).toBe(true);
  });

  it('has lib/kompressa-stack.ts', () => {
    expect(existsSync(join(ROOT, 'lib', 'kompressa-stack.ts'))).toBe(true);
  });

  it('stack file declares expected resources', () => {
    const stack = readFileSync(join(ROOT, 'lib', 'kompressa-stack.ts'), 'utf-8');
    expect(stack).toContain('UploadsBucket');
    expect(stack).toContain('OutputsBucket');
    expect(stack).toContain('JobsTable');
    expect(stack).toContain('WorkerCluster');
    expect(stack).toContain('WorkerTaskDef');
    expect(stack).toContain('ApiFn');
    expect(stack).toContain('HttpApi');
  });
});
