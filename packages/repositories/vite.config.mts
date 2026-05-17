// Repositories package - externalizes workspace deps so npm resolves them at runtime
import { createPatternConfig } from '../utils/build-configs';
export default createPatternConfig(__dirname);
