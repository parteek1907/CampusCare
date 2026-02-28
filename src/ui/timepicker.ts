export class TimePicker {
    private trigger: HTMLElement;
    private value: string = '09:00'; // 24h HH:mm
    private onChange: ((val: string) => void) | null = null;
    private backdrop: HTMLElement | null = null;

    constructor(trigger: HTMLElement, initialValue: string = '09:00', onChange?: (val: string) => void) {
        this.trigger = trigger;
        this.value = initialValue;
        this.onChange = onChange || null;

        this.init();
    }

    private init() {
        // Ensure trigger allows interaction
        this.trigger.style.cursor = 'pointer';
        this.trigger.addEventListener('click', (e) => {
            e.preventDefault();
            this.open();
        });

        // Update initial display (optional, if trigger is input)
        if (this.trigger instanceof HTMLInputElement) {
            this.trigger.value = this.value;
            this.trigger.readOnly = true; // Prevent native keyboard
        } else {
            this.trigger.textContent = this.formatDisplay(this.value);
        }
    }

    private formatDisplay(time24: string): string {
        const [h, m] = time24.split(':').map(Number);
        const period = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, '0')} ${period}`;
    }

    private open() {
        if (this.backdrop) return; // Already open

        // Parse current value
        let [h, m] = this.value.split(':').map(Number);
        let period = h >= 12 ? 'PM' : 'AM';
        let h12 = h % 12 || 12;

        // Create Modal DOM
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'tp-backdrop';

        // Modal Content
        const modal = document.createElement('div');
        modal.className = 'tp-modal fade-in-fast';

        modal.innerHTML = `
            <div class="tp-header">
                <div class="tp-display">
                    <span id="tp-h" class="tp-time-unit active">${h12}</span>
                    <span class="tp-sep">:</span>
                    <span id="tp-m" class="tp-time-unit">${String(m).padStart(2, '0')}</span>
                    <div class="tp-period-toggle">
                        <button class="tp-period ${period === 'AM' ? 'active' : ''}" data-p="AM">AM</button>
                        <button class="tp-period ${period === 'PM' ? 'active' : ''}" data-p="PM">PM</button>
                    </div>
                </div>
            </div>
            
            <div class="tp-body">
                <!-- Hours Grid -->
                <div id="tp-grid-h" class="tp-grid">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n =>
            `<button class="tp-cell ${n === h12 ? 'selected' : ''}" data-val="${n}">${n}</button>`
        ).join('')}
                </div>
                
                <!-- Minutes Grid (Hidden initially? No, side by side or toggle? Requirement says "Floating panel... A. Hour Selector... B. Minute Selector". Usually tabbed or side-by-side. Layout recommended structure says A, B. Let's do side-by-side or togglable. 
                   "Clicking selected hour highlighted... Minute selector..." 
                   Let's use a two-column grid or tabs. A compact list for both is good.
                   Actually, standard mobile pickers toggle between Hour view and Minute view. Let's do that for cleanliness.
                -->
                <div id="tp-grid-m" class="tp-grid hidden">
                    ${[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(n =>
            `<button class="tp-cell ${n === m ? 'selected' : ''}" data-val="${n}">${String(n).padStart(2, '0')}</button>`
        ).join('')}
                </div>
            </div>

            <div class="tp-actions">
                <button id="tp-cancel" class="btn btn-secondary btn-small">Cancel</button>
                <div style="flex:1"></div>
                <button id="tp-ok" class="btn btn-small">Set Time</button>
            </div>
        `;

        this.backdrop.appendChild(modal);
        document.body.appendChild(this.backdrop);

        // --- Logic ---


        const hDisplay = modal.querySelector('#tp-h') as HTMLElement;
        const mDisplay = modal.querySelector('#tp-m') as HTMLElement;
        const hGrid = modal.querySelector('#tp-grid-h') as HTMLElement;
        const mGrid = modal.querySelector('#tp-grid-m') as HTMLElement;

        const switchView = (v: 'h' | 'm') => {
            // view = v; // Removed unused variable assignment
            if (v === 'h') {
                hDisplay.classList.add('active');
                mDisplay.classList.remove('active');
                hGrid.classList.remove('hidden');
                mGrid.classList.add('hidden');
            } else {
                hDisplay.classList.remove('active');
                mDisplay.classList.add('active');
                hGrid.classList.add('hidden');
                mGrid.classList.remove('hidden');
            }
        };

        // Hour Click
        hGrid.addEventListener('click', (e) => {
            const t = e.target as HTMLElement;
            if (t.classList.contains('tp-cell')) {
                // Update State
                h12 = parseInt(t.dataset.val!);

                // Update UI
                hGrid.querySelectorAll('.tp-cell').forEach(b => b.classList.remove('selected'));
                t.classList.add('selected');
                hDisplay.textContent = String(h12);

                // Auto-switch to minutes
                switchView('m');
            }
        });

        // Minute Click
        mGrid.addEventListener('click', (e) => {
            const t = e.target as HTMLElement;
            if (t.classList.contains('tp-cell')) {
                m = parseInt(t.dataset.val!);
                mGrid.querySelectorAll('.tp-cell').forEach(b => b.classList.remove('selected'));
                t.classList.add('selected');
                mDisplay.textContent = String(m).padStart(2, '0');
            }
        });

        // View Toggles
        hDisplay.addEventListener('click', () => switchView('h'));
        mDisplay.addEventListener('click', () => switchView('m'));

        // Period Toggle
        modal.querySelector('.tp-period-toggle')?.addEventListener('click', (e) => {
            const t = e.target as HTMLElement;
            if (t.classList.contains('tp-period')) {
                period = t.dataset.p!;
                modal.querySelectorAll('.tp-period').forEach(b => b.classList.remove('active'));
                t.classList.add('active');
            }
        });

        // Cancel
        modal.querySelector('#tp-cancel')?.addEventListener('click', () => this.close());

        // OK
        modal.querySelector('#tp-ok')?.addEventListener('click', () => {
            // Convert back to 24h
            let h24 = h12;
            if (period === 'PM' && h12 < 12) h24 += 12;
            if (period === 'AM' && h12 === 12) h24 = 0;

            const newVal = `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            this.value = newVal;

            // Update Trigger
            if (this.trigger instanceof HTMLInputElement) {
                this.trigger.value = newVal; // Value keeps 24h format for internal consistency
                // But wait, if input type="time", it expects HH:mm 24h.
                // If input type="text", maybe we show AM/PM. 
                // Plan said "Replace native input". "Replace <input type='time'> with a read-only input". 
                // If I keep type='time', it might show browser UI on mobile or have validation.
                // Ideally change type to 'text' for display or keep 'time' hidden?
                // Simpler: Keep type='time' for value, but browser UI is suppressed by click interception? 
                // Actually changing to type="text" allows showing "09:00 AM".
                // But codebase expects HH:mm 24h in value? 
                // Let's stick to 24h value in input (type=time logic is built around it) but show formatted?
                // Wait, if I change input.value to '09:00', type='time' shows '09:00' (or locale dependent).
                // If I want perfect control, I should arguably change type to 'text' OR use a hidden input for logic.
                // Let's assume standard behavior: update value. 
                this.trigger.dispatchEvent(new Event('change')); // Trigger native change handler if any
            } else {
                this.trigger.textContent = this.formatDisplay(newVal);
            }

            if (this.onChange) this.onChange(newVal);
            this.close();
        });

        // Backdrop Click
        this.backdrop.addEventListener('click', (e) => {
            if (e.target === this.backdrop) this.close();
        });
    }

    private close() {
        if (this.backdrop) {
            this.backdrop.classList.add('fade-out');
            setTimeout(() => {
                this.backdrop?.remove();
                this.backdrop = null;
            }, 200);
        }
    }
}
