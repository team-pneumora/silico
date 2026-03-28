'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signInWithMagicLink, signInWithPassword, signUp } from './actions'

type Mode = 'password' | 'magic-link' | 'signup'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<Mode>('password')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    const formData = new FormData()
    formData.set('email', email)
    formData.set('password', password)

    let result

    if (mode === 'magic-link') {
      result = await signInWithMagicLink(formData)
      if (!result?.error) {
        setStatus('success')
        setMessage(`Magic link sent to ${email}`)
        return
      }
    } else if (mode === 'signup') {
      result = await signUp(formData)
      if (!result?.error) {
        setStatus('success')
        setMessage('Account created! Check your email to confirm.')
        return
      }
    } else {
      result = await signInWithPassword(formData)
      // If successful, redirect happens in the server action
      if (!result) return
    }

    if (result?.error) {
      setStatus('error')
      setMessage(result.error)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8">
          <h1 className="text-xl font-semibold text-neutral-100 text-center mb-1">
            Silico Dashboard
          </h1>
          <p className="text-sm text-neutral-500 text-center mb-8">
            Sign in to manage your AI company
          </p>

          {status === 'success' ? (
            <div className="text-center">
              <p className="text-neutral-200 font-medium mb-2">
                {mode === 'magic-link' ? 'Check your email' : 'Almost there'}
              </p>
              <p className="text-sm text-neutral-500 mb-6">{message}</p>
              <button
                onClick={() => { setStatus('idle'); setMessage('') }}
                className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                Back to login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-neutral-400 mb-1.5">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
                />
              </div>

              {mode !== 'magic-link' && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-neutral-400 mb-1.5">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
                  />
                </div>
              )}

              {status === 'error' && (
                <p className="text-sm text-red-400">{message}</p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-2 px-4 bg-neutral-100 hover:bg-white text-neutral-900 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {status === 'loading'
                  ? 'Loading...'
                  : mode === 'magic-link'
                    ? 'Send Magic Link'
                    : mode === 'signup'
                      ? 'Create Account'
                      : 'Sign In'}
              </button>

              <div className="flex justify-between text-xs text-neutral-600 pt-2">
                {mode === 'password' ? (
                  <>
                    <button type="button" onClick={() => setMode('magic-link')} className="hover:text-neutral-400">
                      Use magic link instead
                    </button>
                    <button type="button" onClick={() => setMode('signup')} className="hover:text-neutral-400">
                      Create account
                    </button>
                  </>
                ) : mode === 'magic-link' ? (
                  <button type="button" onClick={() => setMode('password')} className="hover:text-neutral-400">
                    Use password instead
                  </button>
                ) : (
                  <button type="button" onClick={() => setMode('password')} className="hover:text-neutral-400">
                    Already have an account? Sign in
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-neutral-600 hover:text-neutral-400 transition-colors">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
