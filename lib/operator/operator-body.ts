import { Vector3 } from "three"
import { METERS_PER_INCH } from "lib/units"

/** 6'2" operator. */
export const OPERATOR_HEIGHT_M = 74 * METERS_PER_INCH

/** Body proportions for a 1.88 m adult, used by the rig and the IK. */
export const OPERATOR_BODY = {
  hipHeightM: 1.01,
  ankleHeightM: 0.085,
  thighLengthM: 0.47,
  shinLengthM: 0.455,
  hipHalfWidthM: 0.095,
  shoulderAboveHipM: 0.535,
  shoulderHalfWidthM: 0.215,
  upperArmLengthM: 0.325,
  forearmLengthM: 0.29,
  neckAboveHipM: 0.62,
  /** Furthest a pinch target can be from the shoulder before the operator bends at the hips. */
  comfortableReachM: 0.55,
  maxHipBendRadians: 1.0,
} as const

/** Walking speed along a planned path, and in game mode. */
export const OPERATOR_WALK_SPEED_MPS = 1.35
export const OPERATOR_GAME_WALK_SPEED_MPS = 1.5

/** Where the thumb and fingertips meet, in the hand's local frame. */
export const PINCH_POINT_IN_HAND = new Vector3(0, -0.105, 0.015)

/** Operator-local finger directions. The operator faces local +Z. */
export const RELAXED_FINGER_DIRECTION = new Vector3(0, -0.8, 0.6).normalize()
export const FORWARD_FINGER_DIRECTION = new Vector3(0, -0.35, 0.94).normalize()

export const RELAXED_FINGER_CURL = 0.15
