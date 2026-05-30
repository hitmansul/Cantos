import * as path from 'node:path';
import type { TemplateConfig } from '../template-builder/types';

const TEMPLATE_DIR = __dirname;

export function getV2Config(): TemplateConfig {
  return {
    version: 'v2',
    cpuCount: 8,
    memoryMB: 16384,
    dockerfilePath: path.join(TEMPLATE_DIR, 'Dockerfile'),
    startCmd: '/usr/local/bin/start-cmd.sh',
    readyCmd: '',
  };
}
