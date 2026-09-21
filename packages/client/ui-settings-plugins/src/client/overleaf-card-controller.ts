/**
 * The Overleaf MCP card's staged form over the `overleaf` settings namespace.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  CardForm, textField,
  type CardActions, type CardFieldState, type CardShell,
} from './card-form.ts'

export const OVERLEAF_NS = 'overleaf'
const DEFAULT_API_KEY_REF = 'OVERLEAF_GIT_TOKEN'
const API_KEY_FIELD = 'apiKey'

export interface OverleafSettings {
  apiKeyEnv?: string
  defaultProjectId?: string
  defaultProjectName?: string
  configPath?: string
}

interface CredentialState {
  ref: string
  configured: boolean
  writable: boolean
}

export interface OverleafCardState extends CardShell {
  defaultProjectId: CardFieldState
  defaultProjectName: CardFieldState
  configPath: CardFieldState
  apiKey: CardFieldState
  apiKeyConfigured: boolean
  apiKeyWritable: boolean
}

export interface OverleafCardFace extends CardActions {
  hooks: {
    overleafCard: SnapshotStore<OverleafCardState>
  }
}

export class OverleafCardController {
  private readonly form: CardForm<OverleafSettings>
  private readonly store: SnapshotStore<OverleafCardState>
  private credential: CredentialState = { ref: '', configured: false, writable: true }

  constructor(
    private readonly scope: SettingsScope<OverleafSettings>,
    private readonly ctx: ClientContext,
  ) {
    this.form = new CardForm(
      scope,
      [textField('defaultProjectId'), textField('defaultProjectName'), textField('configPath')],
      [{ field: API_KEY_FIELD, write: text => this.writeKey(text) }],
    )
    this.store = this.form.bind(() => this.projection())
    scope.subscribe(() => { void this.readCredential() })
    void this.readCredential()
  }

  private projection(): OverleafCardState {
    return {
      ...this.form.shell(),
      defaultProjectId: this.form.field('defaultProjectId'),
      defaultProjectName: this.form.field('defaultProjectName'),
      configPath: this.form.field('configPath'),
      apiKey: this.form.field(API_KEY_FIELD),
      apiKeyConfigured: this.credential.configured,
      apiKeyWritable: this.credential.writable,
    }
  }

  private async readCredential(): Promise<void> {
    const ref = refOf(this.scope.getSnapshot())
    if (ref !== this.credential.ref) {
      this.credential = { ref, configured: false, writable: true }
      this.store.set(this.projection())
    }
    const response = await this.ctx.remote.credentials.describe([ref])
    if (!response.ok || ref !== refOf(this.scope.getSnapshot())) return
    const view = response.value[ref]
    const next: CredentialState = {
      ref,
      configured: view?.configured ?? false,
      writable: view?.writable ?? true,
    }
    if (next.configured === this.credential.configured && next.writable === this.credential.writable) return
    this.credential = next
    this.store.set(this.projection())
  }

  refreshCredential(ref: string): void {
    if (ref !== this.credential.ref) return
    void this.readCredential()
  }

  inject(): OverleafCardFace {
    return { hooks: { overleafCard: this.store }, ...this.form.actions() }
  }

  private async writeKey(value: string): Promise<boolean> {
    await this.ctx.remote.credentials.set(refOf(this.scope.getSnapshot()), value)
    await this.readCredential()
    return this.credential.configured
  }
}

function refOf(snapshot: SettingsScopeSnapshot<OverleafSettings>): string {
  const declared = snapshot.value?.apiKeyEnv
  return declared !== undefined && declared.length > 0 ? declared : DEFAULT_API_KEY_REF
}
