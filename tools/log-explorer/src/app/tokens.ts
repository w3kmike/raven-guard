// GSAP easing: CSS cubic-bezier tokens can't drive GSAP without a plugin
export interface MotionEases {
  readonly settle: string;
}

export const eases: MotionEases = {
  settle: 'power3.out',
};
