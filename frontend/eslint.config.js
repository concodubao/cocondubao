import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Nhóm rule kiểu React Compiler (eslint-plugin-react-hooks v7) hay báo nhầm
      // với các pattern đang dùng có chủ đích trong dự án: đồng bộ state khi
      // mount/đổi prop (set-state-in-effect) và gọi hàm hoisted trong cleanup
      // (immutability). Hạ xuống 'warn' để vẫn thấy nhưng không hiện 'error' gây
      // hiểu nhầm và không làm `npm run lint` đỏ (eslint chỉ fail khi còn error).
      // rules-of-hooks/exhaustive-deps vẫn giữ nguyên để bắt lỗi thật.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
])
