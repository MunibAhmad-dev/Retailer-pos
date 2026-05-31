module.exports = {
  presets: ['@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.js', '.android.js', '.js', '.jsx', '.ts', '.tsx', '.json'],
        alias: {
          '@': './src',
          '@components': './src/components',
          '@screens': './src/screens',
          '@theme': './src/theme',
          '@api': './src/api',
          '@store': './src/store',
          '@hooks': './src/hooks',
          '@utils': './src/utils',
          '@i18n': './src/i18n',
        },
      },
    ],
    // react-native-reanimated/plugin MUST be listed last
    'react-native-reanimated/plugin',
  ],
};
