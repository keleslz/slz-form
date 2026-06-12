import { Stack, Typography } from '@mui/material'
import { DebugPanel } from './component/debug-panel'
import { SubmitButton } from './component/submit-button'
import { FORM_1, FORM_2 } from './redux/form'
import { ActionButton } from './component/action-button'
import { RedirectOnFormStatusChange } from './slz-lib/react-slz-form/component/redirect-on-status-change'
import { CarForm } from './page/home/component/car-form'
import { AnotherForm } from './page/home/component/another-form'
import { useCallback, useState } from 'react'

function App() {
  const [showAsynchForm, setShowAsynchForm] = useState(true);
  const searchParams = useCallback(() => new URLSearchParams(window.location.search), []);

  const success = searchParams().get("success") === "true";

  return <Stack spacing={4} direction="row">

    <Stack spacing={2} direction={"column"} sx={{ width: "100%", maxWidth: "50vw" }}>
      <pre>Dernier rafraischissement de page: {JSON.stringify((Date.now() / 1000).toFixed(1))}</pre>
      <ActionButton
        label={showAsynchForm ? "Show asynchronous Form" : "Show synchronous Form"}
        onClick={() => setShowAsynchForm(!showAsynchForm)}
      />
      {success && <Typography variant='h5' color="">Form submitted successfully!</Typography>}
      {showAsynchForm ? <CarForm /> : <AnotherForm />}
      <SubmitButton formId={showAsynchForm ? FORM_1.id : FORM_2.id} />
    </Stack>


    <RedirectOnFormStatusChange
      formId={FORM_1.id}
      to='/?success=true'
      eventType='submitted'
    />

    <DebugPanel />
  </Stack>
}

export default App
