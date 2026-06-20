import { Stack } from '@mui/material'
import { DebugPanel } from './component/debug-panel'
import { CarConfigurationForm } from './page/car/component/car-configuration-form'

function App() {
  return <Stack spacing={4} direction="row">
    <CarConfigurationForm />
    <DebugPanel  />
  </Stack>
}

export default App
