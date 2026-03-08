
const ABSENCE_REASONS = [
    { id: 'sick', label: '🤒 Sick / Health Issue' },
    { id: 'travel', label: '✈️ Travelling' },
    { id: 'overslept', label: '😴 Overslept' },
    { id: 'festival', label: '🎉 Festival / Holiday' },
    { id: 'personal', label: '🧾 Personal Work' },
    { id: 'academic', label: '📖 Academic Preparation' },
    { id: 'home', label: '🏠 Gone Home / Out of Town' },
    { id: 'other', label: '💬 Other' },
];

function getDateWording(dateString?: string) {
    if (!dateString) return { heading: 'Why were you absent?', subtext: 'Select the reason for your absence', submitText: 'Save Reason' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const classDate = new Date(dateString);
    classDate.setHours(0, 0, 0, 0);

    if (classDate.getTime() < today.getTime()) {
        return { heading: 'Why were you absent?', subtext: 'Select the reason for your absence', submitText: 'Save Reason' };
    } else if (classDate.getTime() === today.getTime()) {
        return { heading: 'Why are you absent today?', subtext: 'Select the reason for missing class', submitText: 'Save Reason' };
    } else {
        return { heading: 'Why are you planning to skip?', subtext: 'Select your planned reason for absence', submitText: 'Save Plan' };
    }
}

export class AbsenceModal {
    private static instance: AbsenceModal;
    private container: HTMLElement;
    private resolvePromise: ((value: string | null) => void) | null = null;
    private selectedReason: string | null = null;
    private styleInjected = false;

    private constructor() {
        this.container = document.createElement('div');
        this.container.id = 'absence-modal';
        document.body.appendChild(this.container);
    }

    private injectStyles() {
        if (this.styleInjected) return;
        this.styleInjected = true;

        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes absSlideUp {
                from { opacity: 0; transform: translateY(16px); }
                to   { opacity: 1; transform: translateY(0); }
            }

            #absence-modal {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 9999;
                background: rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(4px);
                place-items: center;
            }
            #absence-modal.visible {
                display: grid;
            }

            .abs-modal-box {
                background: white;
                border-radius: 16px;
                padding: 24px;
                width: min(380px, calc(100vw - 32px));
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
                animation: absSlideUp 0.2s ease;
            }

            .abs-heading {
                font-size: 1.1rem;
                font-weight: 700;
                color: #111827;
                margin: 0 0 4px;
            }
            .abs-subtext {
                font-size: 0.85rem;
                color: #6b7280;
                margin: 0 0 16px;
            }

            .abs-reasons-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                margin-bottom: 20px;
            }

            .abs-reason-btn {
                background: #f8fafc;
                border: 1.5px solid #e5e7eb;
                border-radius: 10px;
                padding: 10px 12px;
                font-size: 0.85rem;
                color: #374151;
                cursor: pointer;
                text-align: left;
                transition: all 0.15s ease;
                font-family: inherit;
            }
            .abs-reason-btn:hover {
                background: #eff6ff;
                border-color: #2563eb;
                color: #1d4ed8;
            }
            .abs-reason-btn.selected {
                background: #eff6ff;
                border-color: #2563eb;
                color: #1d4ed8;
                font-weight: 500;
            }
            .abs-reason-btn.full-width {
                grid-column: 1 / -1;
            }

            .abs-other-input {
                width: 100%;
                padding: 10px 12px;
                border: 1.5px solid #e5e7eb;
                border-radius: 10px;
                font-family: inherit;
                font-size: 0.85rem;
                resize: vertical;
                margin-bottom: 16px;
                box-sizing: border-box;
                transition: border-color 0.15s ease;
            }
            .abs-other-input:focus {
                outline: none;
                border-color: #2563eb;
            }

            .abs-actions {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }
            .abs-skip-btn {
                background: none;
                border: none;
                color: #9ca3af;
                font-size: 0.85rem;
                padding: 8px 12px;
                cursor: pointer;
                font-family: inherit;
            }
            .abs-skip-btn:hover {
                color: #6b7280;
            }
            .abs-submit-btn {
                background: #2563eb;
                color: white;
                border: none;
                border-radius: 8px;
                padding: 10px 20px;
                font-size: 0.875rem;
                font-weight: 500;
                cursor: pointer;
                font-family: inherit;
                transition: background 0.15s ease;
            }
            .abs-submit-btn:hover:not(:disabled) {
                background: #1d4ed8;
            }
            .abs-submit-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        `;
        document.head.appendChild(style);
    }

    private render(dateString?: string) {
        const wording = getDateWording(dateString);

        const reasonButtons = ABSENCE_REASONS.map(r => {
            const isOther = r.id === 'other';
            return `<button class="abs-reason-btn${isOther ? ' full-width' : ''}" data-reason="${r.id}" data-label="${r.label}">${r.label}</button>`;
        }).join('');

        this.container.innerHTML = `
            <div class="abs-modal-box">
                <h3 class="abs-heading">${wording.heading}</h3>
                <p class="abs-subtext">${wording.subtext}</p>
                
                <div class="abs-reasons-grid">
                    ${reasonButtons}
                </div>

                <textarea class="abs-other-input" id="abs-other-text" placeholder="Please specify your reason..." rows="2" style="display:none;"></textarea>

                <div class="abs-actions">
                    <button class="abs-skip-btn" id="abs-skip">Skip</button>
                    <button class="abs-submit-btn" id="abs-submit" disabled>${wording.submitText}</button>
                </div>
            </div>
        `;

        this.setupListeners();
    }

    private setupListeners() {
        this.selectedReason = null;

        const buttons = this.container.querySelectorAll('.abs-reason-btn');
        const otherInput = this.container.querySelector('#abs-other-text') as HTMLTextAreaElement;
        const submitBtn = this.container.querySelector('#abs-submit') as HTMLButtonElement;
        const skipBtn = this.container.querySelector('#abs-skip') as HTMLButtonElement;

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');

                const reasonId = btn.getAttribute('data-reason');
                const reasonLabel = btn.getAttribute('data-label') || reasonId || '';

                if (reasonId === 'other') {
                    otherInput.style.display = 'block';
                    otherInput.focus();
                    this.selectedReason = otherInput.value.trim() || null;
                    submitBtn.disabled = !this.selectedReason;
                } else {
                    otherInput.style.display = 'none';
                    this.selectedReason = reasonLabel;
                    submitBtn.disabled = false;
                }
            });
        });

        otherInput.addEventListener('input', () => {
            const selectedBtn = this.container.querySelector('.abs-reason-btn.selected');
            if (selectedBtn?.getAttribute('data-reason') === 'other') {
                this.selectedReason = otherInput.value.trim() || null;
                submitBtn.disabled = !this.selectedReason;
            }
        });

        submitBtn.addEventListener('click', () => {
            if (this.selectedReason) this.complete(this.selectedReason);
        });

        skipBtn.addEventListener('click', () => this.complete(null));

        // Click outside modal box to dismiss
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) this.complete(null);
        });
    }

    public static getInstance(): AbsenceModal {
        if (!AbsenceModal.instance) AbsenceModal.instance = new AbsenceModal();
        return AbsenceModal.instance;
    }

    public static ask(dateString?: string): Promise<string | null> {
        return AbsenceModal.getInstance().show(dateString);
    }

    private show(dateString?: string): Promise<string | null> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.injectStyles();
            this.render(dateString);
            this.container.classList.add('visible');
        });
    }

    private complete(val: string | null) {
        if (this.resolvePromise) {
            this.resolvePromise(val);
            this.resolvePromise = null;
        }
        this.container.classList.remove('visible');
    }
}
