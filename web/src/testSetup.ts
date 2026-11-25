// Shared Vitest setup. Testing Library's findBy/waitFor give up after 1 s by default; with ~60 jsdom files in
// parallel on a busy machine a correct screen can need longer, which made random tests fail. Only the wait grows;
// no assertion changes.
import { configure } from '@testing-library/dom';

configure({ asyncUtilTimeout: 3000 });
