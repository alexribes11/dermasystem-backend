# -*- coding: utf-8 -*-
"""
Following are the DHR tasks followed in this example code:
    
    -- Applying Morphological Black-Hat transformation
    -- Creating the mask for InPainting task
    -- Applying inpainting algorithm on the image

"""

import cv2
from pathlib import Path
import matplotlib.pyplot as plt
import os
import sys

#PATH_TO_INPUT_IMAGE = "./inputImages/Scalp1_DenseHairs.jpg"
#PATH_TO_INPUT_IMAGE = "./inputImages/DA_Melanoma_9883.jpg"
#NAME_OF_INPUT_IMAGE = Path(PATH_TO_INPUT_IMAGE).stem
NAME_OF_INPUT_IMAGE = sys.argv[1]
PATH_TO_INPUT_IMAGE = "./Images/" + NAME_OF_INPUT_IMAGE
print(NAME_OF_INPUT_IMAGE)

src = cv2.imread(PATH_TO_INPUT_IMAGE)

PATH_TO_OUTPUT_IMAGE_FOLDER = "./outputImages/"
NAME_OF_TYPE_OF_IMAGE = "scalp"

#cv2.imshow(src)

def save_im_to_path(path_to_save_image, im):
    #
    path_to_save_image_with_number = path_to_save_image
    grayscale_image_already_exists = os.path.exists(path_to_save_image_with_number + '.jpg')
    if grayscale_image_already_exists:
        i = 2
        MAX_ITER = 100
        while (grayscale_image_already_exists) and (i < MAX_ITER):
            path_to_save_image_with_number = path_to_save_image + '_' + str(i)
            grayscale_image_already_exists = os.path.isfile(path_to_save_image_with_number + '.jpg')
            i += 1
    
    path_to_save_image_with_number = path_to_save_image_with_number + '.jpg'
    cv2.imwrite(path_to_save_image_with_number, im, [int(cv2.IMWRITE_JPEG_QUALITY), 90])

#
    
print( src.shape )
cv2.imshow("original Image" , src )


# Convert the original image to grayscale
grayScale = cv2.cvtColor( src, cv2.COLOR_RGB2GRAY )
cv2.imshow("GrayScale",grayScale)

PATH_TO_GRAYSCALE_IMAGE = PATH_TO_OUTPUT_IMAGE_FOLDER + 'grayScale/' + NAME_OF_TYPE_OF_IMAGE + '/gS_' + NAME_OF_INPUT_IMAGE
save_im_to_path(PATH_TO_GRAYSCALE_IMAGE, grayScale)

# Kernel for the morphological filtering
kernel = cv2.getStructuringElement(1,(17,17))
print("type(kernel)=", type(kernel))
print(kernel)

# Perform the blackHat filtering on the grayscale image to find the 
# hair countours
blackhat = cv2.morphologyEx(grayScale, cv2.MORPH_BLACKHAT, kernel)
cv2.imshow("BlackHat",blackhat)
#cv2.imwrite(PATH_TO_OUTPUT_IMAGE_FOLDER + 'blackhat/' + NAME_OF_TYPE_OF_IMAGE + '/bh_' + NAME_OF_INPUT_IMAGE + '.jpg', blackhat, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
save_im_to_path(PATH_TO_OUTPUT_IMAGE_FOLDER + 'blackhat/' + NAME_OF_TYPE_OF_IMAGE + '/bh_' + NAME_OF_INPUT_IMAGE, blackhat)

# intensify the hair countours in preparation for the inpainting 
# algorithm
#lower_bound = 10
lower_bound = 80
upper_bound = 255
ret,thresh2 = cv2.threshold(blackhat,lower_bound,upper_bound,cv2.THRESH_BINARY)
print( thresh2.shape )
cv2.imshow("Thresholded Mask",thresh2)
#cv2.imwrite(PATH_TO_OUTPUT_IMAGE_FOLDER + 'thresholded/' + NAME_OF_TYPE_OF_IMAGE + '/th_' + NAME_OF_INPUT_IMAGE + '.jpg', thresh2, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
save_im_to_path(PATH_TO_OUTPUT_IMAGE_FOLDER + 'thresholded/' + NAME_OF_TYPE_OF_IMAGE + '/th_' + NAME_OF_INPUT_IMAGE, thresh2)


# inpaint the original image depending on the mask
dst = cv2.inpaint(src,thresh2,1,cv2.INPAINT_TELEA)
cv2.imshow("InPaint",dst)
#cv2.imwrite(PATH_TO_OUTPUT_IMAGE_FOLDER + 'inpainted/' + NAME_OF_TYPE_OF_IMAGE + '/ip_' + NAME_OF_INPUT_IMAGE + '.jpg', dst, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
save_im_to_path(PATH_TO_OUTPUT_IMAGE_FOLDER + 'inpainted/' + NAME_OF_TYPE_OF_IMAGE + '/ip_' + NAME_OF_INPUT_IMAGE, dst)
