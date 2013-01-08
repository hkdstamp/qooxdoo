/* ************************************************************************

   qooxdoo - the new era of web development

   http://qooxdoo.org

   Copyright:
     2004-2012 1&1 Internet AG, Germany, http://www.1und1.de

   License:
     LGPL: http://www.gnu.org/licenses/lgpl.html
     EPL: http://www.eclipse.org/org/documents/epl-v10.php
     See the LICENSE file in the project's top-level directory for details.

   Authors:
     * Christopher Zuendorf (czuendorf)

************************************************************************ */

/**
 * Creates a drawer widget inside the given parent widget. The parent widget can
 * be assigned as a constructor argument. If no parent is set, the application's root
 * will be assumed as parent. A drawer widget can be assigned to left, right, top or bottom edge of its
 * parent by property "orientation". The drawer floats in on show() and floats out on hide(). Additionally the
 * drawer is shown by swiping in reverse direction on the parent edge to where the drawer is placed to:
 * Orientation: "left", Swipe: "right" on parents edge: Drawer is shown etc.
 * The drawer is hidden when user touches the parent area outside of the drawer. This behaviour can be 
 * deactivated by the property "hideOnParentTouch".
 *     
 * <pre class='javascript'>
 *  
 *  var drawer = new qx.ui.mobile.container.Drawer();
 *  drawer.setOrientation("right");
 *  drawer.setTouchOffset(100);
 *  
 *  var button = new qx.ui.mobile.form.Button("A Button");
 *  drawer.add(button);
 * </pre>
 * 
 * 
 */
qx.Class.define("qx.ui.mobile.container.Drawer",
{
  extend : qx.ui.mobile.container.Composite,


  /*
  *****************************************************************************
     CONSTRUCTOR
  *****************************************************************************
  */

  /**
   * @param parent {qx.ui.mobile.container.Composite?null} The widget to which the drawer should be added,
   *  if null it is added to app root.
   * @param layout {qx.ui.mobile.layout.Abstract?null} The layout that should be used for this
   *     container
   */
  construct : function(parent, layout)
  {
    this.base(arguments);
    if (layout) {
      this.setLayout(layout);
    }
    
    this.initOrientation();
    this.initPositionZ();
    
    if(parent) {
      if (qx.core.Environment.get("qx.debug"))
      {
        this.assertInstance(parent, qx.ui.mobile.container.Composite);
      }
      
      parent.add(this);
    } else {
      qx.core.Init.getApplication().getRoot().add(this);
    }
    
    this.getLayoutParent().addCssClass("drawer-parent");
    this.getLayoutParent().addListener("swipe",this._onParentSwipe,this);
    this.getLayoutParent().addListener("touchstart",this._onParentTouchStart,this);
    this.getLayoutParent().addListener("back",this.forceHide, this);
    
    this.__touchStartPosition = [0,0];
    this.__inAnimation = false;
    
    this.hide();
  },
  
  
  /*
  *****************************************************************************
     PROPERTIES
  *****************************************************************************
  */
  properties : {
    // overridden
    defaultCssClass : {
      refine : true,
      init : "drawer"
    },
    
    
    /** Property for setting the orientation of the drawer.
     * Allowed values are: "left","right","top","bottom" */
    orientation : {
      check : "String",
      init : "left",
      apply : "_applyOrientation"
    },
    
    
    /** The width of the drawer. Only relevant if orientation is "left" or "right". */
    width : {
      check : "Integer",
      init : 300,
      apply : "_applySize"
    },
    
    
    /** The height of the drawer. Only relevant if orientation is "top" or "bottom". */
    height : {
      check : "Integer",
      init : 300,
      apply : "_applySize"
    },
    
    
    /** Indicates whether the drawer should hide when the parent area of it is touched.  */
    hideOnParentTouch : {
      check : "Boolean",
      init : true
    },
    
    
    /** Sets the size of the touching area, where the drawer reacts on swipes for opening itself. */
    touchOffset : {
      check : "Integer",
      init : 20
    },
    
    
    /** Flag is transition should be used when opening/closing the drawer. */
    showTransition : {
      check : "Boolean",
      init : true,
      apply : "_disableTransition"
    },
    
    
    /** Sets the drawer zIndex position relative to its parent. */
    positionZ : {
      check : "String",
      init : "front",
      apply : "_applyPositionZ"
    }
  },
  
  
  /*
  *****************************************************************************
     MEMBERS
  *****************************************************************************
  */
  members :
  { 
    __touchStartPosition : null,
    __parent : null,
    __inAnimation : null,
  
  
    // property apply
    _applyOrientation : function(value, old) {
      this.removeCssClass(old);
      this.addCssClass(value);
      
      var isVertical = value=="left" || value == "right";
      if(isVertical) {
        qx.bom.element.Style.set(this.getContainerElement(),"height",null);
        qx.bom.element.Style.set(this.getContainerElement(),"width",this.getWidth()+"px");
      } else {
        qx.bom.element.Style.set(this.getContainerElement(),"width",null);
        qx.bom.element.Style.set(this.getContainerElement(),"height",this.getHeight()+"px");
      }
    },
    
    
    // property apply
    _applyPositionZ : function(value,old) {
      this.removeCssClass(old);
      this.addCssClass(value);
      
      if(value == "front") {
        // Reset transitions for "back" mode.
        if(this.getLayoutParent()) {
          this.getLayoutParent().setTranslateX(null);
          this.getLayoutParent().setTranslateY(null);
        }
        this.setTranslateX(null);
        this.setTranslateY(null);
      } else {
        this.getLayoutParent().setTranslateX(0);
        this.getLayoutParent().setTranslateY(0);
      }
    },
    
    
    // property apply
    _applySize : function(value, old) {
      // Reapply of orientation.
      this.setOrientation(this.getOrientation());
    },
  
  
    /**
     * Shows the drawer.
     */
    show : function()
    {
      if(this.__inAnimation) {
        return;
      }
      
      this.base(arguments);
      
      this._enableTransition();

      this._toggleParentBlockedState();
      
      if (this.getPositionZ() == "back") {
        if(this.getLayoutParent()) {
          this.getLayoutParent().setTranslateX(0);
          this.getLayoutParent().setTranslateY(0);
        }
       
        this.setTranslateX(0);
        this.setTranslateY(0);

        if(this.getOrientation() == "left") {
          this.getLayoutParent().setTranslateX(this.getWidth());
          this.setTranslateX(-this.getWidth());
        } else if(this.getOrientation() == "right") {
          this.getLayoutParent().setTranslateX(-this.getWidth());
          this.setTranslateX(this.getWidth());
        } else if(this.getOrientation() == "top") {
          this.getLayoutParent().setTranslateY(this.getHeight());
          this.setTranslateY(-this.getHeight());
        } else if(this.getOrientation() == "bottom") {
          this.getLayoutParent().setTranslateY(-this.getHeight());
          this.setTranslateY(this.getHeight());
        }
      }
      
      this.removeCssClass("hidden");
      qx.event.Timer.once(this._disableTransition, this, 500);
      
    },
    
    
    /**
     * Toggles the blocked state of this drawer's parent.
     * Blocked means that no pointer events are received anymore.
     */
    _toggleParentBlockedState : function() {
      if(this.getLayoutParent().hasCssClass("blocked")) {
        this.getLayoutParent().removeCssClass("blocked");
      } else {
        this.getLayoutParent().addCssClass("blocked");
      }
    },
    
    
    /**
     * Hides the drawer.
     */
    hide : function() {
      if(this.__inAnimation) {
        return;
      } 
      
      this._enableTransition();
      
      if (this.getPositionZ() == "back") {
        this.getLayoutParent().setTranslateX(0);
        this.getLayoutParent().setTranslateY(0);
      }
      
      this.addCssClass("hidden");
      
      qx.event.Timer.once(this._toggleParentBlockedState, this, 500);
      qx.event.Timer.once(this._disableTransition, this, 500);
    },
    
    
    /**
     * Strict way to hide this drawer. Removes the blocker from the parent,
     * and hides the drawer without any animation. Should be called when drawer's 
     * parent is animated and drawer should hide immediately.
     */
    forceHide : function() {
      this._disableTransition(); 
      
      if (this.getPositionZ() == "back") {
        this.getLayoutParent().setTranslateX(0);
        this.getLayoutParent().setTranslateY(0);
      }
      
      this.getLayoutParent().removeCssClass("blocked");
      
      this.addCssClass("hidden");
    },
    
    
    // overridden
    isHidden : function() {
      return this.hasCssClass("hidden");
    },
    
    
    /**
     * Enables the transition on this drawer.
     */
    _enableTransition : function() {
      if(this.isShowTransition()) {
        this.__inAnimation = true;
        
        if (this.getPositionZ() == "back") {
          qx.bom.element.Style.set(this.getLayoutParent().getContentElement(),"transition","all .5s ease-in-out");
        } else {
          qx.bom.element.Style.set(this.getContentElement(),"transition","all .5s ease-in-out");
        }
      }
    },
    
    
    /**
     * Disables the transition on this drawer.
     */
    _disableTransition : function() {
      this.__inAnimation = false;
      
      qx.bom.element.Style.set(this.getContentElement(),"transition",null);
      qx.bom.element.Style.set(this.getLayoutParent().getContentElement(),"transition",null);
    },
    
    
    /**
     * Toggle the visibility of the drawer.
     * @param {Boolean} the new visibility state.
     */
    toggleVisibility : function() {
      var newValue = false;
      
      if(this.isHidden()) {
        this.show();
        newValue = true;
      } else {
        this.hide();
        newValue = false;
      }
      
      return newValue;
    },
    
    
    /**
     * Handles a touch on application's root.
     * @param evt {qx.module.event.Touch} Handled touch event.
     */
    _onParentTouchStart : function(evt) {
      var clientX = evt.getAllTouches()[0].clientX;
      var clientY = evt.getAllTouches()[0].clientY;
      
      this.__touchStartPosition = [clientX,clientY];
      
      var isShown = !this.hasCssClass("hidden");
      if(isShown && this.isHideOnParentTouch()) {
        var location = qx.bom.element.Location.get(this.getContainerElement());
        
        if (this.getOrientation() =="left" && this.__touchStartPosition[0] > location.right
        || this.getOrientation() =="top" && this.__touchStartPosition[1] > location.bottom
        || this.getOrientation() =="bottom" && this.__touchStartPosition[1] < location.top
        || this.getOrientation() =="right" && this.__touchStartPosition[0] < location.left)
        {
          // First touch on overlayed page should be ignored.
          evt.preventDefault();
          
          this.hide();
        }
      } 
    },
    
    
    /**
     * Handles a swipe on layout parent.
     * @param evt {qx.module.event.Touch} Handled touch event.
     */
    _onParentSwipe : function(evt) {
      var direction = evt.getDirection();
      var isHidden = this.hasCssClass("hidden");
      if(isHidden) {
        var location = qx.bom.element.Location.get(this.getContainerElement());
        
        if (
          (direction == "right" 
          && this.getOrientation() == "left" 
          && this.__touchStartPosition[0] < location.right + this.getTouchOffset()
          && this.__touchStartPosition[0] > location.right)
          || 
          (direction == "left" 
          && this.getOrientation() == "right"
          && this.__touchStartPosition[0] > location.left - this.getTouchOffset()
          && this.__touchStartPosition[0] < location.left)
          || 
          (direction == "down" 
          && this.getOrientation() == "top"
          && this.__touchStartPosition[1] < this.getTouchOffset() + location.bottom 
          && this.__touchStartPosition[1] > location.bottom) 
          || 
          (direction == "up" 
          && this.getOrientation() == "bottom"
          && this.__touchStartPosition[1] > location.top - this.getTouchOffset()
          && this.__touchStartPosition[1] < location.top)
        )
        {
          this.show();
        }
      } 
    }
  },
  
  
  /*
  *****************************************************************************
     DESTRUCTOR
  *****************************************************************************
  */
  destruct : function()
  {
    this.getLayoutParent().removeListener("swipe",this._onParentSwipe,this);
    this.getLayoutParent().removeListener("touchstart",this._onParentTouchStart,this);
    this.getLayoutParent().removeListener("back", this.forceHide, this);
    
    this.__touchStartPosition = null;
    this.__inAnimation = null;
  }
});