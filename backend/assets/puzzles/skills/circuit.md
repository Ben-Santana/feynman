# Circuit construction skill

Use this recipe whenever generating an electrical circuit apparatus. Model its physical construction on the Ohm’s law reference (frontend/public/simulations/circuit.js), including investigations with a supply, mystery component, and ammeter. Preserve the requested topology and learning task; the reference's resistor-selection problem is only one application.

## 1. Solve and define the network first

Before drawing, define named electrical nodes, each component's two terminals, its constitutive equation, and which node each terminal joins. Keep a single source of truth for component values, terminal coordinates, wire routes, and the equations used by the solution and animation. A wire is a connection between specific terminals, never an approximate line between component centers.

For an ideal DC series network, Rtotal = sum(Ri), I = V/Rtotal, and Vi = I*Ri. For parallel resistors, 1/Rtotal = sum(1/Ri), branch current Ii = V/Ri, and source current = sum(Ii). State idealizations and include every non-ideal load's resistance or supplied I–V law. An ideal zero-resistance indicator lamp may be used only when explicitly stated; do not silently treat a physical lamp as a zero-resistance load. Check Kirchhoff's current and voltage laws. Solve the requested target first, then choose bounds and exactly one correct discrete option when appropriate. Do not invent extra branches, meters, switches, or an answer-changing control for visual interest.

A disconnected component is an open circuit with I=0, not a division by zero. An ideal short across a voltage source is invalid: avoid that state or explicitly model finite source resistance/protection. An ammeter is in series, with two distinct leads and stated ideal negligible resistance; a voltmeter is across the two measured nodes with ideal infinite resistance. A mystery component uses one fixed I(V) law across the full range. Use V/R for an ohmic element. If an unspecified non-ohmic example is needed at fixed temperature, choose a monotonic law such as I = a*V + b*V^3 with stated positive coefficients and units; use that same law everywhere. Do not substitute a linear relationship with a nonlinear animation.

## 2. Match the reference perspective and composition

Start with C=HL.Cam(45, 0.5, 1.38), the reference's 2:1 isometric view: z is vertical, +x runs down-right, +y down-left. Keep this azimuth/elevation, and use one P=HL.proj(C) for every solid, terminal, and wire. Fit once before creating P. HL.fit only centers; reduce the camera scale if needed to keep all extreme poses inside the 400×320 frame. Start with the reference bounds [[-90,-70,0],[95,110,65]] and center (200,148), then include actual glass silhouettes, meter needles, lifted parts, and animation extents. Reserve the top-left legend and bottom-right readings; check projected bounds rather than assuming world bounds include screen-space bulb curves.

Use the reference's spacious triangular arrangement: battery left at (-65,-10), component socket rear at (-30,-55), lamp/load right at (65,8); selectable parts have home positions (-58,88), (0,88), (58,88). These are a baseline, not mandatory extra components. In an investigation, replace or rearrange the needed apparatus while retaining the camera and clear spacing. Give every component its own group and rounded opaque body; do not merge the supply, meter, resistor, and lamp into one box. Keep visible gaps between silhouettes and room to trace each lead. Use recognizable battery contacts, a raised resistor socket, an instrument with a moving needle, and a seated bulb when those parts are required.

## 3. Build contacts, then route leads

Store world-space contacts in a terminal table and use the SAME coordinate arrays to draw contact geometry and terminate leads. For the baseline reference, useful side-contact anchors are:

```js
const terminals = {
  battery: [[-65,-29,2], [-65,9,2]],
  socket: [[-55,-55,2], [-5,-55,2]],
  lamp: [[65,-8,2], [65,24,2]],
};
const routes = [
  [terminals.battery[0], [-65,-55,2], terminals.socket[0]],
  [terminals.socket[1], [65,-55,2], terminals.lamp[0]],
  [terminals.lamp[1], [65,47,2], [-65,47,2], terminals.battery[1]],
];
// P and open are the public HL helpers already in scope.
const wirePath = routes.map(route => open(route.map(q => P(...q)))).join('');
```

This is the three-component series-loop template, not a complete mountPuzzle implementation. Draw visible metal pads/posts at those exact anchors. For a resistor spanning the reference socket, give the installed assembly distinct left/right metal leads meeting x=-55 and x=-5 at y=-55,z=2; raise them into the supported body as needed. Do not leave a gap between the socket contacts and resistor leads. The socket support itself is insulating and never bridges an empty slot.

Adapt the terminal table to the actual component dimensions. Keep external routes outside opaque bodies except at their intended terminal attachment. Use clean axis-aligned world-space bends at a consistent low height. Do not connect to the glass, body center, or a single shared pin. Split an existing route to insert an ammeter in series; do not retain the old bypass wire. Parallel branches must share the exact same endpoint nodes and use visible junction dots. Avoid wire crossings; where unavoidable, use a clear bridge/gap for no connection and a junction dot only for an actual connection. Count terminals and trace a complete source-to-load-to-return path for every intended conducting state. No floating ends, hidden accidental bypasses, or wires through unrelated components.

## 4. Assemble and paint the objects correctly

Use HL.rings/HL.prism/HL.solid/HL.put for rounded bodies. The reference battery occupies x=-77..-53,y=-29..9,z=0..25 with a raised top; socket support x=-55..-5,y=-67..-43,z=0..3; lamp base x=53..77,y=-8..24,z=0..8. These envelopes help separate silhouettes and locate side contacts.

For a lamp, build the base, screw holder from z=8..14, glass neck seated at z=16, and front socket rim from z=14..18. Paint the rim after the glass so the neck visibly seats inside it. Use a quiet filament and simple rays only for a powered outcome. Reuse the reference bulb's recognizable silhouette rather than stacking disconnected ellipses.

Paint low rear wires first, support platforms next, then supported objects; draw exposed contacts and any foreground lead segments in the appropriate depth layer. Sort independent bodies by ascending x+y, but explicitly preserve socket-before-resistor and holder-before-glass-before-front-rim relationships. Clamp supported heights during spring overshoot. An installed resistor's leads remain seated in both contacts; moving a resistor away opens the circuit. Keep contact engagement and electrical state consistent during insertion/removal: never show current through a visibly open gap. Do not make all parts coplanar or transparent to hide routing errors.

## 5. Connect interaction to the same physical model

For resistor selection, keep one active slot; installing a new resistor returns the previous one home. Red hatching identifies movable bodies, green hatching the socket destination. Hit-test the full part in its current target pose. Handle config.value=null as an empty, open slot. Typed choices and pointer drops render the same assembly, and removal calls onValue(null). In ordinary decision puzzles, keep the supply inactive and lamp neutral before config.checked. After checking, derive any current/brightness/protection behavior from the same circuit equations. Use config.solved only for host-authorized completion. If overcurrent protection is specified, too much current trips it; too little current has an interpretable dim/off result. Never make every incorrect resistor produce the same arbitrary animation.

For investigations, keep the network assembled and the current observable live from config.experimentValue, even with config.value=null and before checking. The supply's red physical dial rotates around a fixed center (or a slider moves along a track) as both dragging and typed voltage change. Call onExperimentValue, not onValue, for that control. Compute the ammeter needle and interactions.reading('Measured current', current, 'A') from the same current. Scale the needle for the entire allowed measurement range. Keep conclusion choices separate and never reveal the mystery class through a legend, computed resistance, color, or animation before grading.

Use restrained linework and the shared presentation helpers. Labels and fixed values go in interactions.legend, actual components get the matching color, and live observations go only in interactions.reading. No SVG lettering, floating labels, gradients, decorative platforms, or duplicate control panels. Keep the reference's clean silhouettes and whitespace.

## 6. Circuit acceptance pass

Before returning, check the node/terminal table against EVERY visible wire route. Verify no component is shorted or unintentionally disconnected, the ammeter has no bypass, each intended junction is explicit, and parallel branches actually join the same nodes. Recompute the correct answer and at least one wrong value; check current/voltage conservation and units. Check initial/null state, each choice, both control extremes, replacement/removal, typed values, dragging, wrong submission, edit-after-check, correct submission, and reset. Inspect projected component separation, lead contact alignment, socket seating, painter order, and frame/legend/reading clearance through all poses. Fix any mismatch before returning. These are model self-checks, not proof of automated physics or visual verification.
