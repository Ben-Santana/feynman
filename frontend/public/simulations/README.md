# Apply simulation examples

Admin Developer tools → Apply simulations contains three examples for a future
content-generation model. Every example has a teaching topic, a concrete problem,
a constrained direct manipulation, one large input in the puzzle’s top-right
corner, an explicit Check answer action, and a deterministic result. These are projected 3D solids drawn as SVG; they do not
use a WebGL camera or save student progress.

## Interaction vocabulary

- Red outline plus diagonal hatch: a draggable surface. The complete object's
  body can be grabbed, not just its highlighted face.
- Green outline plus diagonal hatch: an insertion socket or alignment target.
- Labels, hatch patterns, cursors, and equivalent keyboard controls accompany
  colour, so colour alone is never required.
- Springs follow continuous input and animate insertion/removal. Picking uses
  the target geometry, including transformations such as beam rotation.
- Circuit support surfaces are painted before their elevated components; the
  remaining groups follow world-depth order. Resistor height is clamped above
  the socket throughout spring overshoot. The bulb neck seats inside a raised
  screw holder, with its rim drawn in front of the glass.

`interactions.js` defines the shared hatch patterns, outlines, and annotations.
Colour, bolder strokes, and numerical annotations deliberately extend Hairline's
original monochrome conventions at the user's request. The original kernel and
bench remain unchanged, including their license.

## Torque — balance a load

Default problem: a 4 kg load is fixed 3 m left of the pivot. Place a 6 kg
counterweight on the right to balance a weightless beam. Use g = 10 m/s².
The student can move only the counterweight; mass and fixed-load distance cannot
be changed. Any finite distance from 1 to 6 m is accepted, including decimals. Typing,
blurring, and dragging preserve the chosen value without snapping to increments.

The beam is held level during placement. Check answer releases it: incorrect
positions tilt the beam, while a correct position keeps it level. Editing the
answer returns to the held setup. The level-beam torques are mgd. The unique default answer is 2 m, giving 120 N·m
on each side. Completion raises a release pin. Alternate problems have answers
3 m and 6 m. `balance.js` handles the scene and full transformed-body hit region.

## Ohm's law — choose the resistor

Default problem: a 6 V source supplies an ideal lamp with zero resistance. It
needs exactly 0.20 A. The choices are 15 Ω, 30 Ω, and 60 Ω; only 30 Ω works.
The lamp stays off below the required current, and overcurrent protection keeps
it off above it. Wires and the source have no internal resistance.

The student drags a resistor into the green socket, removes it by dragging out,
or replaces it with a different resistor. Only one can be installed. The old
resistor springs home during replacement. The lamp stays off during selection. Only Check answer energizes the circuit;
the correct resistor then lights the lamp and extends its rays. The single
resistance selector in the top-right also supports keyboard selection and removal. Alternate problems use 8 V and 10 V; choice order changes.
`circuit.js` manages drag/capture, spring placement, and depth ordering.

## Right triangle trigonometry — reach the balcony

Default problem: a 10 m ladder must reach a balcony 6 m high and 8 m horizontally
from its foot. The student drags to set an angle or types it in the top-right input. The
ladder stays lowered until Check answer raises it to the selected angle.
The ladder length, balcony height, and horizontal distance are fixed. Numerical
annotations identify the triangle; height and reach are not shown as live answers.

The answer is atan(6/8) ≈ 36.87°. The tip must be within 0.08 m of the landing.
Completion raises the securing gate. Alternate problems use 5–12–13 and 8–15–17
triangles. `ladder.js` manages the scene and its vertical drag interaction.

## State and rebuilding

`frontend/src/components/ApplySimulations.tsx` owns parameters, problem wording,
choice validation, draft inputs, submission state, and solution checks. Figures receive
parameters and send manipulation events over same-origin postMessage. The parent
validates the sender and clamps input. Motion uses Hairline's sleeping,
reduced-motion-aware frame loop. Each subject has three challenge variants.

After editing shared interactions or figure sources, run from the repository root:

    node scripts/build-apply-simulations.mjs

The script replaces only the figure module in each checked-in self-contained HTML
page. Source and license: https://hairline.lucasmarkes.com/skills
