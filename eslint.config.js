import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import tailwind from 'eslint-plugin-tailwindcss';

export default tseslint.config(
    { ignores: ['dist'] },
    {
        extends: [
            js.configs.recommended,
            ...tseslint.configs.recommended,
            ...tailwind.configs["flat/recommended"]
        ],
        files: ['**/*.{ts,tsx}'],
        rules: {
            'tailwindcss/no-custom-classname': 'warn',
            'tailwindcss/no-arbitrary-value': 'warn',
        },
    },
);
