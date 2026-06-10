import type { Reporter, FullResult } from '@playwright/test/reporter';

export default class CustomReporter implements Reporter {
  async onEnd(result: FullResult) {
    console.log('\n[CSS2TW REPORT COMPLETE]\n');
  }
}
