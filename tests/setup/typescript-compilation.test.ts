import { describe, test, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('TypeScript Configuration', () => {
  test('should have valid tsconfig.json', () => {
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json')
    const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf-8')
    const tsconfig = JSON.parse(tsconfigContent)

    // Validate compiler options
    expect(tsconfig.compilerOptions.strict).toBe(true)
    expect(tsconfig.compilerOptions.noEmit).toBe(true)
    expect(tsconfig.compilerOptions.esModuleInterop).toBe(true)
    expect(tsconfig.compilerOptions.jsx).toBe('preserve')
    expect(tsconfig.compilerOptions.module).toBe('esnext')
    expect(tsconfig.compilerOptions.moduleResolution).toBe('bundler')
  })

  test('should have proper path mappings', () => {
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json')
    const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf-8')
    const tsconfig = JSON.parse(tsconfigContent)

    expect(tsconfig.compilerOptions.paths['@/*']).toEqual(['./src/*'])
    expect(tsconfig.compilerOptions.paths['@/components/*']).toEqual(['./src/components/*'])
    expect(tsconfig.compilerOptions.paths['@/lib/*']).toEqual(['./src/lib/*'])
    expect(tsconfig.compilerOptions.paths['@/types/*']).toEqual(['./src/types/*'])
  })

  test('should include necessary files', () => {
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json')
    const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf-8')
    const tsconfig = JSON.parse(tsconfigContent)

    expect(tsconfig.include).toContain('next-env.d.ts')
    expect(tsconfig.include).toContain('**/*.ts')
    expect(tsconfig.include).toContain('**/*.tsx')
    expect(tsconfig.include).toContain('.next/types/**/*.ts')
  })

  test('should exclude build directories', () => {
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json')
    const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf-8')
    const tsconfig = JSON.parse(tsconfigContent)

    expect(tsconfig.exclude).toContain('node_modules')
    expect(tsconfig.exclude).toContain('.next')
    expect(tsconfig.exclude).toContain('out')
  })
})

