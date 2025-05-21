module.exports = {
  env: {
    node: true,
    es2021: true,
    commonjs: true, // Added commonjs for `require` and `module.exports`
  },
  extends: [
    'eslint:recommended',
    'plugin:node/recommended', // Enforces Node.js best practices
    'prettier', // Integrates Prettier, turns off conflicting rules
  ],
  parserOptions: {
    ecmaVersion: 12, // or higher if using newer features not covered by es2021 env
  },
  rules: {
    // Add any project-specific rule overrides here
    'node/no-unpublished-require': 'off', // Allows require in places like config files if not published
    'node/no-missing-require': 'off', // Turn off if it causes issues with dynamic paths, but use with caution
    // Example:
    // 'no-console': 'warn', // To warn about console.log statements
  },
};
