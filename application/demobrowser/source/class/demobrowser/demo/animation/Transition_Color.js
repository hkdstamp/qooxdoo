/* ************************************************************************

qooxdoo - the new era of web development

http://qooxdoo.org

Copyright:
  2004-2008 1&1 Internet AG, Germany, http://www.1und1.de

License:
  LGPL: http://www.gnu.org/licenses/lgpl.html
  EPL: http://www.eclipse.org/org/documents/epl-v10.php
  See the LICENSE file in the project's top-level directory for details.

Authors:
  * Jonathan Weiß (jonathan_rass)

************************************************************************ */

/**
* qx.fx.Transition contains mathematical functions for non-linear transitions in effects.
*/
qx.Class.define("demobrowser.demo.animation.Transition_Color",
{
extend : qx.application.Standalone,

members :
{
 main: function()
 {
   this.base(arguments);

   var doc = this.getRoot();

   var myElement = new qx.ui.embed.Html();
   myElement.setHtml('<span style="color:white;">Welcome to <br><b style="color:#F3FFB3;">qooxdoo</b> animations!</span>');
   myElement.setCssClass("test");

   doc.add(myElement);

   var transitionData = {
     linear      : "Linear is the default transition for many effects.",
     easeInQuad  : "EaseInQuad will accelerate exponentially.",
     easeOutQuad : "EaseOutQuad will slow down exponentially.",
     sinodial    : "sinodial transition will accelerate sinusoidal.",
     reverse     : "Reverse behaves like linear, but in the opposite direction.",
     wobble      : "Wobble will bounce the element forwards and backwards.",
     spring      : "Spring will overshoot the target and then move back.",
     flicker     : "Alternates rapidly between start end target. Looks only nice on color effects.",
     pulse       : "Alternates between start and end. Looks only nice on color effects."
   };


   var combo = new qx.ui.form.ComboBox;
   var btnShow = new qx.ui.form.Button("Show it!");
   var lblName = new qx.ui.basic.Label("Name");
   var lblDesc = new qx.ui.basic.Label("Description");
   var lblDur = new qx.ui.basic.Label("Duration");
   var lblDesc =new qx.ui.basic.Label(transitionData.linear);
   var spDuration = new qx.ui.form.Spinner;

   for (var transition in transitionData) {
     combo.add(new qx.ui.form.ListItem(transition));
   }

   combo.addListener("changeValue", function(e) {
     lblDesc.setValue(transitionData[lblDesc.setValue(e.getData())]);
   });

   spDuration.set({
     maximum : 10.0,
     minimum :  0.1,
     value   :  1.0
   });

   var animMove;
   
   myElement.addListenerOnce("appear", function(){
     animMove = new qx.fx.effect.core.Highlight(myElement.getContentElement().getDomElement());
     animMove.set({
       startColor : "#134275",
       endColor : "#7CFC00"
     });
   }, this);

   var moveBack = false;

   var nf = new qx.util.format.NumberFormat();
   nf.setMaximumFractionDigits(2);
   spDuration.setNumberFormat(nf);

   btnShow.addListener("execute", function(){
     var transition = combo.getValue();
     animMove.set({
       transition : transition,
       duration : spDuration.getValue()
     });

     animMove.start();
   });

   doc.add(lblName, {left : 25, top : 50});
   doc.add(lblDesc, {left : 25, top : 75});
   doc.add(lblDur, {left : 25, top : 25});
   doc.add(combo, {left : 90, top : 50});
   doc.add(lblDesc, {left : 90, top : 75});
   doc.add(spDuration, {left : 90, top : 25});
   doc.add(btnShow, {left : 23, top : 100});

 }
}
});
