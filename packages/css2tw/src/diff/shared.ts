import type { Page, CDPSession } from '@playwright/test';
import type { Logger } from './logger';

export interface DiffEngineInput {
  page1: Page;
  page2: Page;
}

export interface PhaseInput {
  page1: Page;
  page2: Page;
  baseName: string;
  logger: Logger;
  cdp1?: CDPSession;
  cdp2?: CDPSession;
  viewport?: { width: number; height: number };
}

export interface PhaseOutput {
  errors?: number; // legacy/optional for phases that don't need it
  layoutErrors?: number;
  cssErrors?: number;
  uxErrors?: number;
  visualPageErrors?: number;
  visualComponentErrors?: number;
}
