import type { JobProvider, JobProviderAdapter } from '../../../../shared/discovery/types.ts'
import { adzunaAdapter } from './adzuna.ts'
import { ashbyAdapter } from './ashby.ts'
import { greenhouseAdapter } from './greenhouse.ts'
import { leverAdapter } from './lever.ts'
import { remoteOkAdapter } from './remoteok.ts'
import { smartRecruitersAdapter } from './smartrecruiters.ts'

const adapters: Partial<Record<JobProvider, JobProviderAdapter>> = {
  adzuna: adzunaAdapter,
  ashby: ashbyAdapter,
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  remoteok: remoteOkAdapter,
  smartrecruiters: smartRecruitersAdapter,
}

export function getProviderAdapter(provider: JobProvider): JobProviderAdapter {
  const adapter = adapters[provider]
  if (!adapter) throw new Error(`No discovery adapter is registered for ${provider}.`)
  return adapter
}

export {
  adzunaAdapter,
  ashbyAdapter,
  greenhouseAdapter,
  leverAdapter,
  remoteOkAdapter,
  smartRecruitersAdapter,
}
