/* Spike 033-01 follow-up marker bundle — sets self.__RAN so the worker can tell
 * whether importScripts actually executed the fetched script. Served both
 * same-origin and (from a second origin) cross-origin. */
self.__RAN = true;
