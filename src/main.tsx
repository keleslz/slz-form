import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { formRegister } from './form'
import { FormProvider } from './slz-lib-v5/react'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FormProvider register={formRegister}>
      <App />
    </FormProvider>
  </StrictMode>,
)
