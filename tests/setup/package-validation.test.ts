import { describe, test, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Package.json Validation', () => {
  test('should have valid package.json structure', () => {
    const packagePath = path.join(process.cwd(), 'package.json')
    const packageContent = fs.readFileSync(packagePath, 'utf-8')
    const packageJson = JSON.parse(packageContent)

    // Validate required fields
    expect(packageJson.name).toBe('riv-mvp')
    expect(packageJson.version).toBe('0.1.0')
    expect(packageJson.private).toBe(true)
    expect(packageJson.description).toContain('RIV MVP')
  })

  test('should have Next.js 14 dependencies', () => {
    const packagePath = path.join(process.cwd(), 'package.json')
    const packageContent = fs.readFileSync(packagePath, 'utf-8')
    const packageJson = JSON.parse(packageContent)

    expect(packageJson.dependencies.next).toMatch(/^\^14\./)
    expect(packageJson.dependencies.react).toMatch(/^\^18\./)
    expect(packageJson.dependencies['react-dom']).toMatch(/^\^18\./)
  })

  test('should have required dev dependencies', () => {
    const packagePath = path.join(process.cwd(), 'package.json')
    const packageContent = fs.readFileSync(packagePath, 'utf-8')
    const packageJson = JSON.parse(packageContent)

    const requiredDevDeps = [
      'typescript',
      'vitest',
      '@types/react',
      '@types/react-dom',
      '@types/node',
      'tailwindcss',
      'eslint',
      '@testing-library/react'
    ]

    requiredDevDeps.forEach(dep => {
      expect(packageJson.devDependencies[dep]).toBeDefined()
    })
  })

  test('should have required scripts', () => {
    const packagePath = path.join(process.cwd(), 'package.json')
    const packageContent = fs.readFileSync(packagePath, 'utf-8')
    const packageJson = JSON.parse(packageContent)

    const requiredScripts = [
      'dev',
      'build',
      'start',
      'lint',
      'test',
      'test:connectivity',
      'test:performance',
      'test:deployment',
      'type-check'
    ]

    requiredScripts.forEach(script => {
      expect(packageJson.scripts[script]).toBeDefined()
    })
  })

  test('should have proper engine requirements', () => {
    const packagePath = path.join(process.cwd(), 'package.json')
    const packageContent = fs.readFileSync(packagePath, 'utf-8')
    const packageJson = JSON.parse(packageContent)

    expect(packageJson.engines.node).toBe('>=18.0.0')
    expect(packageJson.engines.npm).toBe('>=8.0.0')
  })
})

