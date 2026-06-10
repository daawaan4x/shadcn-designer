import { PhaseInput, PhaseOutput } from './shared';

export async function phase0Stabilize(input: PhaseInput): Promise<PhaseOutput> {
  const { page1, page2 } = input;
  const freezeTransitions = `
    *, *::before, *::after {
      transition: none !important;
      animation: none !important;
      caret-color: transparent !important;
    }
  `;

  await Promise.all([
    page1.addStyleTag({ content: freezeTransitions }),
    page2.addStyleTag({ content: freezeTransitions })
  ]);

  await Promise.all([
    page1.evaluate(() => {
      document.fonts.ready;
      window.scrollTo(0, 0);
    }),
    page2.evaluate(() => {
      document.fonts.ready;
      window.scrollTo(0, 0);
    })
  ]);

  return { errors: 0 };
}
