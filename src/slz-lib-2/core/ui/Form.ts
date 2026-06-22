export class Form {
    private submitted = false;
    
    submit() {
        if (this.submitted) {
            return;
        }
        this.submitted = true;
    }

    public get isSubmit() {
        return this.submitted
    }
}