/* eslint-disable indent,no-multiple-empty-lines,no-undef,no-unused-vars,space-infix-ops,comma-spacing,no-trailing-spaces,object-property-newline */
import * as d3      from 'd3';
import { Oscil }    from './d3Component/oscil';
import { Buzz }      from './d3Component/buzz';
import * as debug   from 'debug';
import * as _       from 'lodash';

export class Layout {
    constructor(editor) {
        this.editor = editor;
        this.oscil = null;
        this.buzz = null;
        this.fixedCircle = null;
        this.log = debug('layout');
        this.path = null;
        this.links = null;
        this.selectedNode = null;
        this.selectedLink = null;
        this.mousedownLink = null;
        this.mousedownNode = null;
        this.mouseupNode = null;
        this.circle = null;
        this.nodes = null;
        this.colors = null;
        this.dragLine = null;
        this.force = null;
        this.svg = null;
        // only respond once per keydown
        this.lastKeyDown = -1;
        this.drag = null;
        this.selectedComponent = null;
    }

    getEditor() {
        return this.editor;
    }

    resetMouseVars() {
        this.log('resetMouseVars');
        this.mousedownNode = null;
        this.mouseupNode = null;
        this.mousedownLink = null;
    }

    // update graph (called when needed)
    restart() {
        this.log('restart');
        d3.selectAll('.superg').attr('transform', 'scale(' + this.editor.scale + ')');
        // path (link) group
        this.path = this.path.data(this.links);

        // update existing links
        this.path.classed('selected', (d) => d === this.selectedLink)
          .style('marker-start', (d) => d.left ? 'url(#start-arrow)' : '')
          .style('marker-end', (d) => d.right ? 'url(#end-arrow)' : '');

        // remove old links
        this.path.exit().remove();

        // add new links
        this.path = this.path.enter().append('svg:path')
          .attr('transform', 'scale(' + this.editor.scale + ')')
          .attr('class', 'link')
          .classed('selected', (d) => d === this.selectedLink)
          .style('marker-start', (d) => d.left ? 'url(#start-arrow)' : '')
          .style('marker-end', (d) => d.right ? 'url(#end-arrow)' : '')
          .on('mousedown', (d) => {
            if (d3.event.ctrlKey) return;



            // select link
            this.mousedownLink = d;
            this.selectedLink = (this.mousedownLink === this.selectedLink) ? null : this.mousedownLink;
            this.selectedNode = null;
            // this.selectedComponent = null;
            this.restart();
          })
          .merge(this.path);

        // circle (node) group
        // NB: the function arg is crucial here! nodes are known by id, not by index!
        this.circle = this.circle.data(this.nodes, (d) => d.id);

        // update existing nodes (reflexive & selected visual states)
        this.circle.selectAll('circle')
          .style('fill', (d) => (d === this.selectedNode) ? d3.rgb(this.colors(d.id)).brighter().toString() : this.colors(d.id))
          .classed('reflexive', (d) => d.reflexive);
        this.circle.exit().remove();

        // add new nodes
        const g = this.circle.enter().append('svg:g');
        var scope = this;
        g.append('svg:circle')
          .attr('class', 'node')
          .attr('id', function (d) {
            return 'circle_' + d.id;
          })
          .attr('r', 12)
          .style('fill', (d) => (d === this.selectedNode) ? d3.rgb(this.colors(d.id)).brighter().toString() : this.colors(d.id))
          .style('stroke', (d) => d3.rgb(this.colors(d.id)).darker().toString())
          .style('display', (d) => {
            if (!d.isChild) {
                return 'none';
            } else {
                return 'block';
            }
          })
          .classed('reflexive', (d) => d.reflexive)
          .on('mouseover', function (d) {
            if (!scope.mousedownNode || d === scope.mousedownNode) return;
            // enlarge target node
            d3.select(this).attr('transform', 'scale(1.1)');
          })
          .on('mouseout', function (d) {
            if (!scope.mousedownNode || d === scope.mousedownNode) return;
            // unenlarge target node
            d3.select(this).attr('transform', '');
          })
          .on('mousedown', function (d) {
            if (d3.event.ctrlKey) return;

            // select node
            scope.mousedownNode = d;
            scope.selectedNode = (scope.mousedownNode === scope.selectedNode) ? null : scope.mousedownNode;
            scope.selectedLink = null;
            // scope.selectedComponent = null;

            // reposition drag line
            scope.dragLine
              .style('marker-end', 'url(#end-arrow)')
              .classed('hidden', false)
              .attr('d', `M${scope.mousedownNode.x * scope.editor.scale},${scope.mousedownNode.y * scope.editor.scale}L${scope.mousedownNode.x * scope.editor.scale},${scope.mousedownNode.y * scope.editor.scale}`);

            scope.restart();
          })
          .on('mouseup', function (d) {
            if (!scope.mousedownNode) return;

            // needed by FF
            scope.dragLine
              .classed('hidden', true)
              .style('marker-end', '');

            // check for drag-to-self
            scope.mouseupNode = d;
            if (scope.mouseupNode === scope.mousedownNode) {
              scope.resetMouseVars();
              return;
            }

            // unenlarge target node
            d3.select(this).attr('transform', '');

            // add link to graph (update if exists)
            // NB: links are strictly source < target; arrows separately specified by booleans
            const isRight = scope.mousedownNode.id < scope.mouseupNode.id;
            const source = isRight ? scope.mousedownNode : scope.mouseupNode;
            const target = isRight ? scope.mouseupNode : scope.mousedownNode;

            const link = scope.links.filter((l) => l.source === source && l.target === target)[0];
            if (link) {
              link[isRight ? 'right' : 'left'] = true;
            } else {
              scope.links.push({ source, target, left: !isRight, right: isRight });
            }

            // select new link
            scope.selectedLink = link;
            scope.selectedNode = null;
            // scope.selectedComponent = null;
            scope.restart();
          }).on('dblclick', (d) => {
            d.fixed = false;
            d3.select('#circle_' + d.id).classed('fixed', false);
            d.fx = null;
            d.fy = null; 
          });
 
        this.oscil = new Oscil();
        this.buzz = new Buzz();

        this.fixedCircle = g.filter(function (d) {
            return !d.isChild && d.type === 'oscil';
        });

        this.fixedCircleBuzz = g.filter(function (d) {
            return !d.isChild && d.type === 'buzz';
        });


        this.log('FIXED CIRCLE LENGTH ******', this.fixedCircle.length);

        this.oscil.draw(this.fixedCircle, this.nodes, this);
        this.buzz.draw(this.fixedCircleBuzz, this.nodes, this);



        this.circle = g.merge(this.circle);

        // set the graph in motion
        this.force
          .nodes(this.nodes)
          .force('link').links(this.links);

        this.force.alphaTarget(0.3).restart();
    }

    // update force layout (called automatically each iteration)
    tick() {
      // draw directed edges with proper padding from node centers
      this.path.attr('d', (d) => {
        const deltaX = d.target.x - d.source.x;
        const deltaY = d.target.y - d.source.y;
        const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const normX = deltaX / dist;
        const normY = deltaY / dist;
        const sourcePadding = d.left ? 17 : 12;
        const targetPadding = d.right ? 17 : 12;
        const sourceX = d.source.x + (sourcePadding * normX);
        const sourceY = d.source.y + (sourcePadding * normY);
        const targetX = d.target.x - (targetPadding * normX);
        const targetY = d.target.y - (targetPadding * normY);

        return `M${sourceX},${sourceY}L${targetX},${targetY}`;
      }).attr('transform', 'scale(' + this.editor.scale +  ')');
        

      this.circle.attr('transform', (d) => {
        return `translate(${d.x},${d.y})`;
      });
    }

    mousedown(event) {
      // because :active only works in WebKit?
      this.svg.classed('active', true);
      this.log('mousedown');

      if ((d3.event && d3.event.ctrlKey) || this.mousedownNode || this.mousedownLink) return;
      this.log('after this ctrlkey');

      // insert new node at point
      const point = d3.mouse(event);
      var oscil = new Oscil();
      oscil.addCircle(this, point);
      this.restart();
    }

    mousemove(event) {
      if (!this.mousedownNode) return;

      // update drag line
      this.dragLine
            .attr('d', `M${this.mousedownNode.x * this.editor.scale},${this.mousedownNode.y * this.editor.scale}L${d3.mouse(event)[0]},${d3.mouse(event)[1]}`)
            .style('stroke-width', 4 * this.editor.scale + 'px');

      this.restart();
    }

    mouseup() {
      if (this.mousedownNode) {
        // hide drag line
        this.dragLine
          .classed('hidden', true)
          .style('stroke-width', '0px')
          .style('marker-end', '');
      }

      this.log('mouseup');
      // because :active only works in WebKit?
      this.svg.classed('active', false);

      // clear mouse event vars
      this.resetMouseVars();
    }

    keyup() {
      this.lastKeyDown = -1;
    }

    removeFromArray(original, remove) {
        return original.filter(value => !remove.includes(value));
    }

    keydown() {
      // d3.event.preventDefault();

      if (this.lastKeyDown !== -1) return;
      this.lastKeyDown = d3.event.keyCode;

      if (!this.selectedNode && !this.selectedLink && !this.selectedComponent) return;

      switch (d3.event.keyCode) {
        case 46: // delete
          if (this.selectedLink) {
            this.links.splice(this.links.indexOf(this.selectedLink), 1);
          } else if (this.selectedComponent) {
            for (var i = 0; i <= this.selectedComponent.children.length; i++) {
                this.nodes = _.filter(this.nodes, (o) => {
                    return o.id !== this.selectedComponent.children[i];
                });
            }
            this.nodes = _.filter(this.nodes, (o) => {
                return o.id !== this.selectedComponent.master;
            });
            // TO DO:
          }
          this.selectedLink = null;
          this.selectedNode = null;
          // this.selectedComponent = null;
          this.restart();
          break;
        case 66: // B
          if (this.selectedLink) {
            // set link direction to both left and right
            this.selectedLink.left = true;
            this.selectedLink.right = true;
          }
          this.restart();
          break;
        case 76: // L
          if (this.selectedLink) {
            // set link direction to left only
            this.selectedLink.left = true;
            this.selectedLink.right = false;
          }
          this.restart();
          break;
        case 82: // R
          if (this.selectedNode) {
            // toggle node reflexivity
            this.selectedNode.reflexive = !this.selectedNode.reflexive;
          } else if (this.selectedLink) {
            // set link direction to right only
            this.selectedLink.left = false;
            this.selectedLink.right = true;
          }
          this.restart();
          break;
      }
    }

    spliceLinksForNode(node) {
      const toSplice = this.links.filter((l) => l.source === node || l.target === node);
      for (const l of toSplice) {
        this.links.splice(this.links.indexOf(l), 1);
      }
    }

    draw() {
        // set up SVG for D3
        const width = 960;
        const height = 500;
        this.colors = d3.scaleOrdinal(d3.schemeCategory10);

        this.svg = d3.select('.linen-container')
          .append('svg')
          .attr('oncontextmenu', 'return false;')
          .attr('width', width)
          .attr('height', height);

        // set up initial nodes and links
        //  - nodes are known by 'id', not by index in array.
        //  - reflexive edges are indicated on the node (as a bold black circle).
        //  - links are always source < target; edge directions are set by 'left' and 'right'.
        //
        this.lastNodeId = -1;
        this.links = [];
        this.nodes = [];


        /// var oscil = new Oscil();
        /// oscil.addCircle(this, [550, 225]); 
        // init D3 force layout
        this.force = d3.forceSimulation()
          .force('link', d3.forceLink().id((d) => d.id).distance(150))
          .force('charge', d3.forceManyBody().strength(-400))
          .force('x', d3.forceX(width / 2))
          .force('y', d3.forceY(height / 2))
          .on('tick', this.tick.bind(this));

        // init D3 drag support
        this.drag = d3.drag()
          .on('start', (d) => {
            if (!d3.event.active) this.force.alphaTarget(0.3).restart();

            d.fixed = false;
            d3.select('#circle_' + d.id).classed('fixed', true);
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (d) => {
            d3.select('#circle_' + d.id).classed('fixed', true);
            d.fx = d3.event.x;
            d.fy = d3.event.y;
          })
         .on('end', (d) => {
            d.fy = d3.event.y;
            d.fixed = true;
            d3.select('#circle_' + d.id).classed('fixed', true);
          });

        // define arrow markers for graph links
        this.svg.append('svg:defs').append('svg:marker')
            .attr('id', 'end-arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 6)
            .attr('markerWidth', 3)
            .attr('markerHeight', 3)
            .attr('orient', 'auto')
          .append('svg:path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#000');

        this.svg.append('svg:defs').append('svg:marker')
            .attr('id', 'start-arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 4)
            .attr('markerWidth', 3)
            .attr('markerHeight', 3)
            .attr('orient', 'auto')
          .append('svg:path')
            .attr('d', 'M10,-5L0,0L10,5')
            .attr('fill', '#000');

        // line displayed when dragging new nodes
        this.dragLine = this.svg.append('svg:path')
          .attr('class', 'link dragline hidden')
          .attr('d', 'M0,0L0,0');

        // handles to link and node element groups
        this.path = this.svg.append('svg:g').selectAll('path');
        this.circle = this.svg.append('svg:g')
            .attr('class', 'superg')
            .attr('transform', 'scale(' + this.editor.scale + ')')
            
            .selectAll('g');

        // mouse event vars
        this.selectedNode = null;
        this.selectedLink = null;
        this.selectedComponent = null;
        this.mousedownLink = null;
        // this.mousedownNode = null;
        this.mouseupNode = null;

        var scope = this;
        // app starts here
        this.svg.on('mousedown', function() {
            scope.mousedown.bind(scope)(this);
        }).on('mousemove', function () {
            scope.mousemove.bind(scope)(this);
        }).on('mouseup', function () {
            scope.mouseup.bind(scope)(this)
        });
        d3.select(window)
          .on('keydown', this.keydown.bind(this))
          .on('keyup', this.keyup.bind(this));
        this.restart();
    }
}
