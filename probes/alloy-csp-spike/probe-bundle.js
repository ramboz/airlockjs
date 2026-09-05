/* Spike 033-01 probe — same-origin stand-in for the 766 KB stock alloy bundle.
 * CSP `script-src` treats a same-origin 1 KB and a same-origin 766 KB script
 * identically for admission, so this isolates the CSP mechanism from any
 * alloy-shim breakage (alloy's own boot under this shim is already proven
 * CSP-less by rig:alloy). If this line runs, importScripts was ADMITTED. */
self.__BUNDLE_RAN = true;
