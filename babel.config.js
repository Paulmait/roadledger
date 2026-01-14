module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@/components': './src/components',
            '@/hooks': './src/hooks',
            '@/stores': './src/stores',
            '@/services': './src/services',
            '@/lib': './src/lib',
            '@/types': './src/types',
            '@/constants': './src/constants',
            '@/utils': './src/utils',
          },
        },
      ],
    ],
  };
};
