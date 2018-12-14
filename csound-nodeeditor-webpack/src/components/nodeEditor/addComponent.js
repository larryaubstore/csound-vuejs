/* eslint-disable eqeqeq */
import Rete               from 'rete';
import { NumControl }     from './numControl';

export class AddComponent extends Rete.Component {
    constructor(numSocket){
        super('Add');
        this.numSocket = numSocket;
    }

    builder(node) {
        var inp1 = new Rete.Input('num1', 'Number', this.numSocket);
        var inp2 = new Rete.Input('num2', 'Number2', this.numSocket);
        var out = new Rete.Output('num', 'Number', this.numSocket);

        inp1.addControl(new NumControl(this.editor, 'num1'))
        inp2.addControl(new NumControl(this.editor, 'num2'))

        return node
            .addInput(inp1)
            .addInput(inp2)
            .addControl(new NumControl(this.editor, 'preview', true))
            .addOutput(out);
    }

    worker(node, inputs, outputs) {
        var n1 = inputs['num1'].length ? inputs['num1'][0] : node.data.num1;
        var n2 = inputs['num2'].length ? inputs['num2'][0] : node.data.num2;
        var sum = n1 + n2;

        this.editor.nodes.find(n => n.id == node.id).controls.get('preview').setValue(sum);
        outputs['num'] = sum;
    }
}
