import { $ } from '../utils';

export class Modal {
    private static instance: Modal;
    private container: HTMLElement;
    private resolvePromise: ((value: any) => void) | null = null;
    private currentType: 'alert' | 'confirm' | 'prompt' = 'alert';

    private constructor() {
        this.container = document.createElement('div');
        this.container.id = 'global-modal';
        this.container.className = 'modal-backdrop hidden';
        this.container.innerHTML = `
            <div class="modal-content">
                <h3 id="modal-title" style="margin-bottom:0.5rem; font-size:1.25rem;"></h3>
                <p id="modal-message" style="color:var(--color-text-muted); margin-bottom:1rem;"></p>
                <div id="modal-input-container" class="hidden" style="margin-bottom:1.5rem;">
                    <input type="text" id="modal-input" placeholder="" class="w-full" style="width:100%; padding:0.75rem; border:1px solid var(--color-border); border-radius:var(--radius-lg); font-family:inherit;">
                </div>
                <div class="modal-actions">
                    <button id="modal-cancel" class="btn btn-secondary">Cancel</button>
                    <button id="modal-confirm" class="btn">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(this.container);

        $('#modal-cancel').addEventListener('click', () => this.handleClose());
        $('#modal-confirm').addEventListener('click', () => this.handleConfirm());

        const input = $<HTMLInputElement>('#modal-input');
        input.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') this.handleConfirm();
            if (e.key === 'Escape') this.handleClose();
        });
    }

    public static getInstance(): Modal {
        if (!Modal.instance) Modal.instance = new Modal();
        return Modal.instance;
    }

    private show(title: string, message: string, type: 'alert' | 'confirm' | 'prompt', confirmText = 'OK', cancelText = 'Cancel', placeholder = '', danger = false): Promise<any> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.currentType = type;

            $('#modal-title').textContent = title;
            $('#modal-message').innerHTML = message;

            const confirmBtn = $('#modal-confirm');
            const cancelBtn = $('#modal-cancel');
            confirmBtn.textContent = confirmText;
            cancelBtn.textContent = cancelText;

            // Type Logic
            if (type === 'alert') {
                cancelBtn.classList.add('hidden');
            } else {
                cancelBtn.classList.remove('hidden');
            }

            // Input Logic
            const inputCont = $('#modal-input-container');
            const input = $<HTMLInputElement>('#modal-input');
            if (type === 'prompt') {
                inputCont.classList.remove('hidden');
                input.value = '';
                input.placeholder = placeholder;
                setTimeout(() => input.focus(), 50);
            } else {
                inputCont.classList.add('hidden');
            }

            // Danger Style
            if (danger) {
                confirmBtn.style.backgroundColor = '#ef4444';
                confirmBtn.style.borderColor = '#ef4444';
            } else {
                confirmBtn.removeAttribute('style'); // reset to css
            }

            this.container.classList.remove('hidden');
        });
    }

    private handleConfirm() {
        if (!this.resolvePromise) return;

        if (this.currentType === 'prompt') {
            const val = $<HTMLInputElement>('#modal-input').value;
            this.resolvePromise(val);
        } else {
            this.resolvePromise(true);
        }
        this.hide();
    }

    private handleClose() {
        if (!this.resolvePromise) return;

        if (this.currentType === 'confirm') {
            this.resolvePromise(false);
        } else if (this.currentType === 'prompt') {
            this.resolvePromise(null);
        } else {
            this.resolvePromise(true); // alert always resolves
        }
        this.hide();
    }

    private hide() {
        this.container.classList.add('hidden');
        this.resolvePromise = null;
    }

    // --- Static API ---

    public static alert(message: string, title = 'Notification'): Promise<void> {
        return Modal.getInstance().show(title, message, 'alert');
    }

    public static confirm(message: string, title = 'Confirm Action', danger = false): Promise<boolean> {
        return Modal.getInstance().show(title, message, 'confirm', 'Yes', 'Cancel', '', danger);
    }

    public static prompt(message: string, title = 'Input Required', placeholder = ''): Promise<string | null> {
        return Modal.getInstance().show(title, message, 'prompt', 'Submit', 'Cancel', placeholder);
    }
}
