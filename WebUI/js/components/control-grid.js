/**
 * @component ControlGrid
 * @purpose Web Component para el wrapper estructural del control-grid (2 filas)
 * @classification UI Component
 * @complexity Low
 */
(function() {
    const template = `
        <div class="control-grid">
            <!-- FILA SUPERIOR -->
            <div class="row">
                <arp-seq-section></arp-seq-section>

                <lfo-section></lfo-section>

                <poly-section></poly-section>

                <programmer-section></programmer-section>
            </div>

            <!-- FILA INFERIOR: Ruta de Síntesis Principal -->
            <div class="row">
                <osc-section></osc-section>

                <vcf-section></vcf-section>

                <vca-section></vca-section>

                <hpf-section></hpf-section>

                <env-section></env-section>
            </div>
        </div>
    `;

    class ControlGrid extends HTMLElement {
        connectedCallback() {
            if (this.children.length === 0) {
                this.innerHTML = template;
            }
        }
    }
    customElements.define('control-grid', ControlGrid);
})();
