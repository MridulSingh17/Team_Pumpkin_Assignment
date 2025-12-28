const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Expo config plugin to fix react-native-camera variant ambiguity
 * This adds missingDimensionStrategy to resolve the general/mlkit flavor conflict
 */
const withReactNativeCameraFix = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      const buildGradle = config.modResults.contents;
      
      // Check if missingDimensionStrategy already exists
      if (!buildGradle.includes('missingDimensionStrategy')) {
        // Find the defaultConfig block and add missingDimensionStrategy
        const defaultConfigRegex = /(defaultConfig\s*\{)/;
        if (defaultConfigRegex.test(buildGradle)) {
          config.modResults.contents = buildGradle.replace(
            defaultConfigRegex,
            `$1
        // Fix react-native-camera variant ambiguity
        missingDimensionStrategy 'react-native-camera', 'general'`
          );
        } else {
          // If defaultConfig doesn't exist, add it inside android block
          const androidBlockRegex = /(android\s*\{)/;
          if (androidBlockRegex.test(buildGradle)) {
            config.modResults.contents = buildGradle.replace(
              androidBlockRegex,
              `$1
    defaultConfig {
        // Fix react-native-camera variant ambiguity
        missingDimensionStrategy 'react-native-camera', 'general'
    }`
            );
          }
        }
      }
    }
    return config;
  });
};

module.exports = withReactNativeCameraFix;

