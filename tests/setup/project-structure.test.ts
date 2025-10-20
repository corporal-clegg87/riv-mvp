import { describe, test, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Project Structure Validation', () => {
  test('should have required directories', () => {
    const requiredDirs = [
      'src',
      'src/app',
      'src/components',
      'src/types',
      'tests'
    ]

    requiredDirs.forEach(dir => {
      const dirPath = path.join(process.cwd(), dir)
      expect(fs.existsSync(dirPath)).toBe(true)
    })
  })

  test('should have required files', () => {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'tailwind.config.js',
      'postcss.config.js',
      'next.config.js',
      '.eslintrc.json',
      'src/app/layout.tsx',
      'src/app/page.tsx',
      'src/app/globals.css',
      'src/components/HelloWorld.tsx',
      'src/types/index.ts'
    ]

    requiredFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file)
      expect(fs.existsSync(filePath)).toBe(true)
    })
  })

  test('should have valid Next.js app structure', () => {
    const appDir = path.join(process.cwd(), 'src/app')
    const layoutFile = path.join(appDir, 'layout.tsx')
    const pageFile = path.join(appDir, 'page.tsx')
    const globalsFile = path.join(appDir, 'globals.css')

    expect(fs.existsSync(layoutFile)).toBe(true)
    expect(fs.existsSync(pageFile)).toBe(true)
    expect(fs.existsSync(globalsFile)).toBe(true)
  })

  test('should have proper component structure', () => {
    const componentsDir = path.join(process.cwd(), 'src/components')
    const helloWorldFile = path.join(componentsDir, 'HelloWorld.tsx')

    expect(fs.existsSync(componentsDir)).toBe(true)
    expect(fs.existsSync(helloWorldFile)).toBe(true)
  })
})

