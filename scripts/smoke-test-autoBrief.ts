import { buildAutoBriefPrompt, parseAutoBriefDraft } from '../src/autoBriefPrompt';
import * as cp from 'child_process';

interface TestCase {
  name: string;
  input: string;
  expected: {
    detected_mode: string;
    execution_mode: string;
    method_label_suffix: string | null;
    composite_notes_empty: boolean;
  };
}

const TEST_CASES: TestCase[] = [
  {
    name: "Test 1 — Retroactive ablation (NeurIPS spring-mass)",
    input: "Retroactive: register our spring-mass MLLM-guided optimization run on PhysTwin-Cam1 single-view. Test error beat CMA-ES with ~4x speedup. Used SAM3D + MoGe + PnP + ARAP pipeline for monocular reconstruction. Logs at ~/phystwin-paper/runs/sm_cam1_mllm/, final checkpoint sm_final.pt. Don't re-run anything.",
    expected: {
      detected_mode: "retroactive",
      execution_mode: "human",
      method_label_suffix: "-retro",
      composite_notes_empty: true,
    }
  },
  {
    name: "Test 2 — Infrastructure (data loader)",
    input: "Build a PyTorch DataLoader for the baseline X dataset. Needs to load monocular video sequences and emit (frames, camera_poses, mesh_init) tuples compatible with both spring-mass and MPM solver input formats. Variable sequence length, batch size 1 for now.",
    expected: {
      detected_mode: "infrastructure",
      execution_mode: "agent",
      method_label_suffix: null,
      composite_notes_empty: true,
    }
  },
  {
    name: "Test 3 — Codebase understanding",
    input: "Understand baseline X's training pipeline. I need to identify retrofit points for our MLLM reasoning loop. Focus on how it parameterizes physical parameters and where the loss surface is computed. Look at optim/, loss/, and the main training entry.",
    expected: {
      detected_mode: "codebase",
      execution_mode: "agent",
      method_label_suffix: null,
      composite_notes_empty: true,
    }
  },
  {
    name: "Test 4 — Edge case: build + understand → codebase",
    input: "Build a data loader to understand baseline X's training pipeline. The DataLoader will tee inputs so I can inspect intermediate tensors as the loss is computed.",
    expected: {
      detected_mode: "codebase",
      execution_mode: "agent",
      method_label_suffix: null,
      composite_notes_empty: false,  // Should have composite note about build component
    }
  },
  {
    name: "Test 5 — Failed retroactive (NeurIPS P3 cut alternative)",
    input: "Retroactive: we tried using only MoGe depth without SAM3D segmentation for spring-mass optimization on PhysTwin-Cam1. Test error degraded ~30% vs the full pipeline; we abandoned this direction and cut it from the paper. Logs at ~/phystwin-paper/runs/sm_cam1_moge_only/.",
    expected: {
      detected_mode: "retroactive",
      execution_mode: "human",
      method_label_suffix: "-retro",
      composite_notes_empty: true,
    }
  },
];

async function detectClaudePath(): Promise<string | undefined> {
  try {
    const result = cp.execSync('which claude', { encoding: 'utf-8' }).trim();
    return result || undefined;
  } catch {
    return undefined;
  }
}

async function runTest(testCase: TestCase, claudePath: string): Promise<boolean> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${testCase.name}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Input: ${testCase.input.slice(0, 100)}...`);

  try {
    // Build prompt
    const prompt = buildAutoBriefPrompt(testCase.input, []);

    // Call Claude SDK
    const sdk = await import('@anthropic-ai/claude-agent-sdk');
    console.log('Calling Claude Opus 4 via SDK...');

    const result = await sdk.unstable_v2_prompt(prompt, {
      model: 'claude-opus-4-7',
      pathToClaudeCodeExecutable: claudePath,
    });

    if (result.subtype !== 'success') {
      throw new Error(`SDK returned non-success: ${result.subtype}`);
    }

    // Parse response
    const draft = parseAutoBriefDraft(result.result);

    // Print results
    console.log('\n--- Results ---');
    console.log(`detected_mode:     ${draft.detected_mode}`);
    console.log(`composite_notes:   ${draft.composite_notes.length === 0 ? '(empty)' : JSON.stringify(draft.composite_notes)}`);
    console.log(`method_label:      ${draft.method_label}`);
    console.log(`execution_mode:    ${draft.execution_mode}`);

    // Validation
    const checks = [];

    // Check detected_mode
    const modeMatch = draft.detected_mode === testCase.expected.detected_mode;
    checks.push({
      name: 'detected_mode',
      pass: modeMatch,
      expected: testCase.expected.detected_mode,
      actual: draft.detected_mode,
    });

    // Check execution_mode
    const execMatch = draft.execution_mode === testCase.expected.execution_mode;
    checks.push({
      name: 'execution_mode',
      pass: execMatch,
      expected: testCase.expected.execution_mode,
      actual: draft.execution_mode,
    });

    // Check method_label suffix
    const labelHasRetro = draft.method_label.endsWith('-retro');
    const labelMatch = testCase.expected.method_label_suffix === '-retro'
      ? labelHasRetro
      : !labelHasRetro;
    checks.push({
      name: 'method_label_suffix',
      pass: labelMatch,
      expected: testCase.expected.method_label_suffix || '(no -retro)',
      actual: labelHasRetro ? '-retro' : '(no -retro)',
    });

    // Check composite_notes
    const notesEmpty = draft.composite_notes.length === 0;
    const notesMatch = notesEmpty === testCase.expected.composite_notes_empty;
    checks.push({
      name: 'composite_notes_empty',
      pass: notesMatch,
      expected: testCase.expected.composite_notes_empty ? 'empty' : 'non-empty',
      actual: notesEmpty ? 'empty' : 'non-empty',
    });

    // Print check results
    console.log('\n--- Validation ---');
    let allPass = true;
    for (const check of checks) {
      const icon = check.pass ? '✓' : '✗';
      const status = check.pass ? 'PASS' : 'FAIL';
      console.log(`${icon} ${check.name}: ${status} (expected: ${check.expected}, actual: ${check.actual})`);
      if (!check.pass) allPass = false;
    }

    console.log(`\n${allPass ? '✓ ALL CHECKS PASSED' : '✗ SOME CHECKS FAILED'}`);
    return allPass;

  } catch (error: any) {
    console.error(`\n✗ ERROR: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    return false;
  }
}

async function main() {
  console.log('Cairn Auto-Brief Smoke Test');
  console.log('Testing work-type-aware routing with 5 NeurIPS prompts\n');

  // Detect Claude CLI
  const claudePath = await detectClaudePath();
  if (!claudePath) {
    console.error('ERROR: Claude CLI not found in PATH. Please install it first.');
    process.exit(1);
  }
  console.log(`Found Claude CLI at: ${claudePath}\n`);

  // Run all tests
  const results: boolean[] = [];
  for (const testCase of TEST_CASES) {
    const pass = await runTest(testCase, claudePath);
    results.push(pass);
  }

  // Print summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(80)}`);
  const passCount = results.filter(r => r).length;
  const totalCount = results.length;
  console.log(`${passCount}/${totalCount} tests passed`);

  for (let i = 0; i < results.length; i++) {
    const icon = results[i] ? '✓' : '✗';
    console.log(`${icon} ${TEST_CASES[i].name}`);
  }

  process.exit(passCount === totalCount ? 0 : 1);
}

main();
