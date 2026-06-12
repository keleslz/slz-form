import { Box, List, Typography } from "@mui/material";
import { useAppSelector } from "../../redux";

export function DebugPanel() {
    const form = useAppSelector((state) => state.form);

    if (!form) {
        return null;
    }

    return <Box sx={{ width: "250px" }} role="presentation" >
        <Typography variant="h6">Form state</Typography>
        <pre>
            {JSON.stringify(form, null, 2)}
        </pre>
        <List>
            {/* {['Inbox', 'Starred', 'Send email', 'Drafts'].map((text) => (
                <Stack key={text} direction={"column"}>
                    <ListItem key={text} disablePadding>
                        {text}
                    </ListItem>
                    <br />
                </Stack>
            ))} */}
        </List>
    </Box>
}