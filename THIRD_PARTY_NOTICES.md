# Third-party notices

## adobe-rnd/aem-martech

`adapters/eds/martech.js` is a structural re-expression, written against the Airlock handle, of the public API and flows of
[`adobe-rnd/aem-martech`](https://github.com/adobe-rnd/aem-martech) (`src/index.js`, pinned at commit `1aa3dee3`).

Copyright Adobe. Licensed under the Apache License, Version 2.0. You may obtain a copy of the License at
<http://www.apache.org/licenses/LICENSE-2.0>. Unless required by applicable law or agreed to in writing, the software is
distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

Changes: the code runs against the `bootAlloy` handle instead of `window.alloy`, loads no Alloy bundle or ACDL on the main
thread, and carries the differences listed in the header of `adapters/eds/martech.js`.
