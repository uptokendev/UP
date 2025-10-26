# Hook Enforcement (Plain English)
- OFF: Wallet “Send” works; your dApp also works. Only dApp applies fees.
- ON: Wallet “Send” is blocked. Your dApp/CLI still works and applies fees.
One-time per mint: register two fixed “extra accounts” for the hook: config PDA (seed 'config') and auth PDA (seed 'auth').
