export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !relative || /\.[cm]?jsx?$/.test(specifier)) throw error;
    return nextResolve(`${specifier}.js`, context);
  }
}
