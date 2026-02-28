import { $ } from '../utils';

export class AbsenceModal {
    private static instance: AbsenceModal;
    private container: HTMLElement;
    private resolvePromise: ((value: string | null) => void) | null = null;

    private constructor() {
        this.container = document.createElement('div');
        this.container.id = 'absence-modal';
        this.container.className = 'modal-backdrop hidden';

        // Using existing modal styles (modal-backdrop, modal-content) from style.css likely, 
        // or defining inline to match EXACTLY as requested if style.css classes aren't sufficient.
        // Based on Modal.ts, it uses 'modal-backdrop' and 'modal-content'.
        this.container.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <h3 style="margin-bottom:1rem; font-size:1.25rem; text-align:center;">Why were you absent?</h3>
                
                <div id="reason-options" style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom:1.5rem;">
                    <button class="reason-btn" data-reason="Health Issue">Health Issue</button>
                    <button class="reason-btn" data-reason="Personal Work">Personal Work</button>
                    <button class="reason-btn" data-reason="Academic Preparation">Academic Preparation</button>
                    <button class="reason-btn" data-reason="Travel">Travel</button>
                    <button class="reason-btn" data-reason="Family Responsibility">Family Responsibility</button>
                    <button class="reason-btn" data-reason="Other">Other</button>
                </div>

                <div id="other-reason-container" class="hidden" style="margin-bottom:1rem; animation:fadeUp 0.2s ease-out;">
                    <textarea id="other-reason-input" placeholder="Please specify your reason..." rows="3" 
                        style="width:100%; padding:0.75rem; border:1px solid #e2e8f0; border-radius:8px; font-family:inherit; resize:vertical;"></textarea>
                </div>

                <div class="modal-actions" style="display:flex; gap:10px; justify-content:flex-end;">
                    <button id="abs-cancel" class="btn btn-secondary" style="flex:1;">Cancel</button>
                    <button id="abs-confirm" class="btn" style="flex:1;" disabled>Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(this.container);

        // Styling for reason buttons (mimicking radio behavior visually)
        const style = document.createElement('style');
        style.innerHTML = `
            .reason-btn {
                background: white;
                border: 1px solid #e2e8f0;
                padding: 0.75rem;
                border-radius: 8px;
                text-align: left;
                cursor: pointer;
                transition: all 0.2s;
                font-weight: 500;
                color: #475569;
            }
            .reason-btn:hover {
                border-color: var(--color-primary);
                background: #f8fafc;
            }
            .reason-btn.selected {
                background: #eff6ff;
                border-color: var(--color-primary);
                color: var(--color-primary);
                font-weight: 600;
                box-shadow: 0 0 0 1px var(--color-primary);
            }
        `;
        document.head.appendChild(style);

        this.setupListeners();
    }

    private setupListeners() {
        const options = this.container.querySelectorAll('.reason-btn');
        const otherContainer = $<HTMLDivElement>('#other-reason-container');
        const otherInput = $<HTMLTextAreaElement>('#other-reason-input');
        const confirmBtn = $<HTMLButtonElement>('#abs-confirm');
        const cancelBtn = $<HTMLButtonElement>('#abs-cancel');

        let selectedReason: string | null = null;

        options.forEach(btn => {
            btn.addEventListener('click', () => {
                // UI Toggle
                options.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');

                const val = btn.getAttribute('data-reason');
                if (val === 'Other') {
                    otherContainer.classList.remove('hidden');
                    otherInput.focus();
                    selectedReason = otherInput.value.trim() || null; // Wait for input
                    confirmBtn.disabled = !selectedReason;
                } else {
                    otherContainer.classList.add('hidden');
                    selectedReason = val;
                    confirmBtn.disabled = false;
                }
            });
        });

        otherInput.addEventListener('input', () => {
            if ($('.reason-btn.selected')?.getAttribute('data-reason') === 'Other') {
                selectedReason = otherInput.value.trim();
                confirmBtn.disabled = !selectedReason;
            }
        });

        confirmBtn.addEventListener('click', () => {
            if (selectedReason) this.complete(selectedReason);
        });

        cancelBtn.addEventListener('click', () => this.complete(null));

        // Click outside
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) this.complete(null); // click backdrop
        });
    }

    public static getInstance(): AbsenceModal {
        if (!AbsenceModal.instance) AbsenceModal.instance = new AbsenceModal();
        return AbsenceModal.instance;
    }

    public static ask(): Promise<string | null> {
        return AbsenceModal.getInstance().show();
    }

    private show(): Promise<string | null> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;

            // Reset State
            this.container.querySelectorAll('.reason-btn').forEach(b => b.classList.remove('selected'));
            $<HTMLDivElement>('#other-reason-container').classList.add('hidden');
            $<HTMLTextAreaElement>('#other-reason-input').value = '';
            $<HTMLButtonElement>('#abs-confirm').disabled = true;

            this.container.classList.remove('hidden');
        });
    }

    private complete(val: string | null) {
        if (this.resolvePromise) {
            this.resolvePromise(val);
            this.resolvePromise = null;
        }
        this.container.classList.add('hidden');
    }
}
