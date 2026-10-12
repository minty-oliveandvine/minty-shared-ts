// Runs before every test file.
//
// jest-dom's matchers are imported from the '/vitest' entry point, not the bare package: the
// bare one registers against Jest's expect and silently adds nothing here.

import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

import { _setViewerLoaderForTests } from "../src/lib/viewer";
import { installFakeHost } from "./fakeHost";

// Every test starts with a host registered and nobody looking. Without a host the packaged
// components throw by design, and a test that forgot one would fail with that error rather than
// its own; without this, the viewer read would reach the host's loadViewer on mount and take a
// queued fetch answer that the test meant for something else.
beforeEach(() => {
  installFakeHost();
  _setViewerLoaderForTests(() => Promise.resolve(null));
});

// findBy*/waitFor wait 2.5s, not the default 1s - minty-web's value, kept so a test behaves the
// same here as it did there.
configure({ asyncUtilTimeout: 2500 });

// RTL only auto-cleans when a global `afterEach` exists, and this project runs with globals
// disabled -- so without this, every render stacks up in the same document.
afterEach(() => {
  cleanup();
  _setViewerLoaderForTests(null);
});
