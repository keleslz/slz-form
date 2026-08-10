import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { formRegister } from './form'
import { FormProvider } from 'slz-react-form'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FormProvider register={formRegister}>
      <App />
    </FormProvider>
  </StrictMode>,
)
