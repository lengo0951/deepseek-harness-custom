/**
 * The Overleaf MCP provider's card: its Git credentials, default project ID/name, and config path.
 */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { SecretField, ValueField } from './fields.tsx'
import { PluginCard } from './PluginCard.tsx'
import type { OverleafCardFace } from './overleaf-card-controller.ts'
import type {} from './slot-contract.ts'

export type OverleafCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'settings.plugins'>
  & InjectFace<OverleafCardFace>

export function OverleafCard(props: OverleafCardProps) {
  const { t } = props
  const state = props.useOverleafCard(snapshot => snapshot)
  const disabled = !state.writable
  return (
    <PluginCard
      t={t}
      titleKey="overleafTitle"
      descriptionKey="overleafDescription"
      state={state}
      onSave={props.save}
      onDiscard={props.discard}
    >
      <SecretField
        id="plugin-config-overleaf-key"
        label={t('overleafApiKey')}
        hint={t('overleafApiKeyHint')}
        disabled={!state.apiKeyWritable}
        text={state.apiKey.text}
        configured={state.apiKeyConfigured}
        stateLabel={state.apiKeyConfigured ? t('overleafApiKeySet') : t('overleafApiKeyUnset')}
        onEdit={(text) => { props.edit('apiKey', text) }}
      />
      <ValueField
        id="plugin-config-overleaf-project-id"
        label={t('overleafDefaultProjectId')}
        hint={t('overleafDefaultProjectIdHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        {...state.defaultProjectId}
        onEdit={(text) => { props.edit('defaultProjectId', text) }}
        onReset={() => { props.resetField('defaultProjectId') }}
      />
      <ValueField
        id="plugin-config-overleaf-project-name"
        label={t('overleafDefaultProjectName')}
        hint={t('overleafDefaultProjectNameHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        {...state.defaultProjectName}
        onEdit={(text) => { props.edit('defaultProjectName', text) }}
        onReset={() => { props.resetField('defaultProjectName') }}
      />
      <ValueField
        id="plugin-config-overleaf-config-path"
        label={t('overleafConfigPath')}
        hint={t('overleafConfigPathHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        {...state.configPath}
        onEdit={(text) => { props.edit('configPath', text) }}
        onReset={() => { props.resetField('configPath') }}
      />
    </PluginCard>
  )
}
