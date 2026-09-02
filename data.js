/* Render Consistency - shared project data.
   Loaded by index.html and by the per-model gallery pages, so the project
   list lives in exactly one place. */
window.RC = {

  /* Examples are numbered only. `outputs` lists the AI outputs a project has;
     `exampleOutputs` narrows that for individual examples whose set is not
     complete yet.

     New projects are Gemini only. The three earlier projects keep the ChatGPT
     outputs that were already made for them. */
  projects: [
    { id: 'the-prospect', name: 'The Prospect', count: 4, outputs: ['gemini', 'chatgpt'] },
    { id: '29',           name: '29',           count: 3, outputs: ['gemini', 'chatgpt'] },
    { id: 'bl-community', name: 'BL Community', count: 4, outputs: ['gemini', 'chatgpt'] },
    { id: 'rapa-nui',     name: 'Rapa Nui',     count: 4, outputs: ['gemini'] },
    { id: 'mismo',        name: 'Mismo',        count: 8, outputs: ['gemini'] },
    { id: 'utah-poolhouse', name: 'Utah Poolhouse', count: 5, outputs: ['gemini'] },
    { id: 'prince',       name: 'Prince',       count: 6, outputs: ['gemini'] },
    { id: 'national',     name: 'National',     count: 4, outputs: ['gemini'] },
    { id: 'tres-chollas', name: 'Tres Chollas', count: 4, outputs: ['gemini'] },
    { id: 'm-residence',  name: 'M Residence',  count: 5, outputs: ['gemini'] },
    { id: 'ozarks-residence', name: 'Ozarks Residence', count: 6, outputs: ['gemini'] },
    { id: 'cedar-park',    name: 'Cedar Park',    count: 5, outputs: ['gemini'] },
    { id: 'howard',       name: 'Howard',       count: 5, outputs: ['gemini'] },
    { id: 'f-residence',  name: 'F Residence',  count: 5, outputs: ['gemini'] }
  ],

  labels: { gemini: 'Gemini', chatgpt: 'ChatGPT', original: 'Render' },

  pad: function (n) {
    return n < 10 ? '0' + n : String(n);
  },

  outputsFor: function (project, name) {
    return (project.exampleOutputs && project.exampleOutputs[name]) || project.outputs;
  },

  src: function (projectId, name, variant) {
    return 'images/' + projectId + '/' + name + '--' + variant + '.jpg';
  },

  /* Every example of a project that actually has the given output. */
  examplesWith: function (project, variant) {
    var out = [];
    for (var n = 1; n <= project.count; n++) {
      var name = this.pad(n);
      if (this.outputsFor(project, name).indexOf(variant) !== -1) out.push(name);
    }
    return out;
  }
};
