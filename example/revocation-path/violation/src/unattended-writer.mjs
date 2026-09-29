#!/usr/bin/env node
import { appendFileSync } from 'node:fs';

const [, , ledgerPath, writeIntervalMsArg, ignoreSigtermArg] = process.argv;
const writeIntervalMs = Number(writeIntervalMsArg);
const ignoreSigterm = ignoreSigtermArg === 'true';

if (ignoreSigterm) {
  process.on('SIGTERM', () => {});
}

setInterval(() => {
  appendFileSync(ledgerPath, `${Date.now()}\n`);
}, writeIntervalMs);
